
function create_elem(elem_type, cls) {
    let e = document.createElement(elem_type);
    if (cls !== undefined && cls !== null) {
        if (!Array.isArray(cls))
            cls = [cls]
        e.classList = cls.join(" ")
    }
    return e
}
function add_elem(parent, elem_type, cls) {
    let e = create_elem(elem_type, cls)
    parent.appendChild(e)
    return e
}
function add_elem_id(parent, elem_type, cls, id) {
    let e = create_elem(elem_type, cls)
    parent.appendChild(e)
    e.setAttribute("id", id)
    return e
}



const NODES_GRID_SIZE = 50

function round_to(x, v) {
    return Math.round(x / v) * v
}



class NodesView extends ViewBase
{
    constructor(canvas) {
        super(canvas)
        this.hover = undefined

        this.draw_nodes_rec = 0 // draw_connection is called from draw_nodes and from outside as well

        this.nodes = []

        panel_mouse_control(this, canvas)
        panel_mouse_wheel(this, canvas)
    }

    nodes_draw_start() {
        ++this.draw_nodes_rec;
        if (this.draw_nodes_rec != 1)
            return
        this.ctx.save()
        const z = this.zoom
        this.ctx.transform(z, 0, 0, z, this.pan_x*z, this.pan_y*z)
        //ctx_nd_shadow.save()
        //ctx_nd_shadow.transform(z, 0, 0, z, this.pan_x*z, this.pan_y*z)
    }
    
    nodes_draw_end() {
        --this.draw_nodes_rec;
        if (this.draw_nodes_rec != 0)
            return
        this.ctx.restore()
        //ctx_nd_shadow.restore()
    }
    
    pan_redraw(and_save = true)
    {   
        //if (and_save)
        //    save_state()
        this.ctx.lineWidth = 1
        this.ctx.fillStyle = '#efefef'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.textBaseline = "top"
    
       // ctx_nd_shadow.fillStyle = "#000"
       // ctx_nd_shadow.fillRect(0, 0, canvas_nd_shadow.width, canvas_nd_shadow.height)
        
        this.nodes_draw_start()
    
        const left = -this.pan_x, top = -this.pan_y
        const right = this.canvas.width / this.zoom - this.pan_x
        const bottom = this.canvas.height / this.zoom - this.pan_y
    
        // grid
        this.ctx.beginPath();
        for(let x = round_to(left, NODES_GRID_SIZE); x < right; x += NODES_GRID_SIZE) {
            this.ctx.moveTo(x, top)
            this.ctx.lineTo(x, bottom)
        }
        for(let y = round_to(top, NODES_GRID_SIZE); y < bottom; y += NODES_GRID_SIZE) {
            this.ctx.moveTo(left, y)
            this.ctx.lineTo(right, y)
        }    
        this.ctx.strokeStyle = "#dddddd"
        this.ctx.stroke()
    
        // nodes
    
        for(let n of this.nodes) {
            n.draw(this.ctx);
        }

    
        this.nodes_draw_end()
    }

    redraw() {
        this.pan_redraw()
    }

    find_obj(ev) {
        for(let node of this.nodes) {
            const hit = node.find_obj(ev)
            if (hit !== null)
                return hit
        }
        return null
    }
}

class CallHandler
{
    constructor(func) {
        this.func = func
    }
    mousedown(e) {
        this.func(this.node) 
    }
    mouseup() {
    }
    mousemove(ev) {
    }
}

const NODE_WIDTH = 150
const NODE_HEIGHT = 60
const OPEN_BTN_WIDTH = 20
const OPEN_BTN_HEIGHT = 20
const BTN_PLUS_OFFSET = 6

class Node
{
    constructor(card, id)
    {
        this.id = id
        this.card = card
        this.parent = null
        this.children = []

        this.center = [0,0]
        this.visible = false
        this.children_open = false
    }

    set_visible(v) {
        this.visible = v
    }

    child_open_btn() {
        const cx = this.center[0], cy = this.center[1]  + 30
        return {cx:cx, cy:cy, x:cx - OPEN_BTN_WIDTH/2, y:cy- OPEN_BTN_HEIGHT/2, w:OPEN_BTN_WIDTH, h:OPEN_BTN_HEIGHT}
    }

    open_children() {
        this.children_open = !this.children_open

        nodes_view.redraw()
    }

    find_obj(ev) {
        const child_open = this.child_open_btn()
        if (rect_hit(ev.vx, ev.vy, child_open))
            return new CallHandler(()=>{this.open_children()})
        return null
    }

    draw(ctx)
    {
        if (!this.visible)
            return
        ctx.strokeStyle = "#444444"
        const top_y = this.center[0] - NODE_HEIGHT/2
        const left_x = this.center[1] - NODE_WIDTH/2
        ctx.strokeRect(left_x, top_y, NODE_WIDTH, NODE_HEIGHT)

        ctx.font = "16px Verdana"
        ctx.fillStyle = "#000000"
        ctx.fillText(this.card.name, left_x + 5, top_y + 5)
        ctx.fillText(this.card.title, left_x + 5, top_y + 25)

        const child_open = this.child_open_btn();
        ctx.fillStyle = "#dddddd"
        ctx.fillRect(child_open.x, child_open.y, child_open.w, child_open.h)
        ctx.strokeRect(child_open.x, child_open.y, child_open.w, child_open.h)
        ctx.beginPath()

        ctx.moveTo(child_open.cx - BTN_PLUS_OFFSET, child_open.cy)
        ctx.lineTo(child_open.cx + BTN_PLUS_OFFSET, child_open.cy)
        if (!this.children_open)
        {
            ctx.moveTo(child_open.cx, child_open.cy - BTN_PLUS_OFFSET)
            ctx.lineTo(child_open.cx, child_open.cy + BTN_PLUS_OFFSET)
        }
        ctx.stroke()
    }
}



class Card
{
    constructor(name, title, child_ids)
    {
        this.name = name
        this.title = title
       // this.img_url = img_url
        this.children_ids = child_ids
    }
}

const cards_db = [
    new Card("Top Guy", "CEO", [1, 2]),
    new Card("Money Guy", "CFO", []),
    new Card("Top Dev", "dev lead", [3, 4, 5]),
    new Card("Dev One", "developer", []),
    new Card("Dev Two", "developer", []),
    new Card("Mid Man", "team lead", [6, 7]),
    new Card("Low Man", "junior dev", []),
    new Card("Low Woman", "junior dev", [])
]

function create_nodes(cards)
{
    const nodes = []
    for(let card of cards)
        nodes.push(new Node(card))
    // connect children and parent
    for(let node of nodes) 
    {
        for(let cid of node.card.children_ids)
        {
            node.children.push()
            nodes[cid].parent = nodes[node.id]
        }
    }
    return nodes
}


let canvas_nodes = null
let nodes_view = null

function page_onload()
{
    canvas_nodes = add_elem_id(body, 'canvas', null, "canvas_nodes")
    canvas_nodes.width = 1200
    canvas_nodes.height = 800

    nodes_view = new NodesView(canvas_nodes)

    nodes_view.nodes = create_nodes(cards_db)
    nodes_view.nodes[0].set_visible(true)

    nodes_view.pan_redraw()
    
}