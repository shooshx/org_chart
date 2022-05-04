
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
function assert(b, msg) {
    if (!b)
        throw new Error(msg)
}


class NodesView extends ViewBase
{
    constructor(canvas) {
        super(canvas)
        this.hover = undefined

        this.draw_nodes_rec = 0 // draw_connection is called from draw_nodes and from outside as well

        this.model = null

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
    
        for(let n of this.model.nodes) {
            n.draw(this.ctx);
        }

    
        this.nodes_draw_end()
    }

    redraw() {
        this.pan_redraw()
    }

    find_obj(ev) {
        for(let node of this.model.nodes) {
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
const NODE_MARGIN = 10
const OPEN_BTN_WIDTH = 15
const OPEN_BTN_HEIGHT = 15
const BTN_PLUS_OFFSET = 5
const BTN_OFFS = 3
const CHILD_LINE_Y_OFFS = NODE_HEIGHT/2 + OPEN_BTN_HEIGHT/2 + BTN_OFFS
const PARENT_LINE_Y_OFFS = NODE_HEIGHT/2
const TEXT_MARGIN = {x:5, y:10}

const NAR_NODE_WIDTH = 100
const NAR_NODE_HEIGHT = 40
const NAR_NODE_MARGIN = 5

function draw_plus_btn(ctx, rect, plussed)
{
    ctx.fillStyle = "#dddddd"
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    ctx.beginPath()

    ctx.moveTo(rect.cx - BTN_PLUS_OFFSET, rect.cy)
    ctx.lineTo(rect.cx + BTN_PLUS_OFFSET, rect.cy)
    if (plussed)
    {
        ctx.moveTo(rect.cx, rect.cy - BTN_PLUS_OFFSET)
        ctx.lineTo(rect.cx, rect.cy + BTN_PLUS_OFFSET)
    }
    ctx.stroke()
}

// this is used so that the node we're on would not move due to the root being hidden
let global_x_shift = 0

class Node
{
    constructor(card, id)
    {
        this.id = id
        this.card = card
        this.parent = null
        this.sibling_pos = null
        this.children = []
        this.level = null
        this.level_pos = null // my index in my level's nodes list

        this.sibling_x = 0
        this.center_offset = {x:0, y:0}
        this.visible = false
        this.children_open = false
        this.parent_open = true
        this.tree_width = 0   // width of the entire subtree starting with me

        this.is_narrow = false
        this.narrow_child = { count: 0, stack_height: 0 }
        this.narrow_pos = { ix: 0, iy: 0 }
    }

    center() {
        const ly = this.level.level_y()

        const r = { x:this.center_offset.x + this.sibling_x + global_x_shift, y:this.center_offset.y + ly }
        if (this.is_narrow) {
            r.x += this.narrow_pos.ix * NAR_NODE_WIDTH
            r.y += this.narrow_pos.iy * NAR_NODE_HEIGHT
        }
        return r
    }

    set_visible(v) {
        this.visible = v
    }
    set_visible_rec_children(v) {
        this.visible = v
        this.children_open = v
        for(let c of this.children)
            c.set_visible_rec_children(v)
    }

    set_visible_with_children(v) {
        this.visible = v
        this.children_open = v
        for(let c of this.children)
            c.set_visible(v)
    }

    set_invisible_rec_parent(except_node) {
        this.visible = false
        this.children_open = false
        this.parent_open = false
        for(let c of this.children)
            if (c !== except_node)
                c.set_visible_rec_children(false)
        if (this.parent !== null)
            this.parent.set_invisible_rec_parent(this) // exclude this since it was already taken care of and we don't want to revisit
    }
    set_narrow(v) {
        this.is_narrow = v
    }

    child_open_btn() {
        const center = this.center()
        const cx = center.x, cy = center.y  + NODE_HEIGHT/2 + BTN_OFFS
        return {cx:cx, cy:cy, x:cx - OPEN_BTN_WIDTH/2, y:cy- OPEN_BTN_HEIGHT/2, w:OPEN_BTN_WIDTH, h:OPEN_BTN_HEIGHT}
    }
    parent_open_btn() {
        const center = this.center()
        const cx = center.x, cy = center.y  - NODE_HEIGHT/2 - BTN_OFFS
        return {cx:cx, cy:cy, x:cx - OPEN_BTN_WIDTH/2, y:cy- OPEN_BTN_HEIGHT/2, w:OPEN_BTN_WIDTH, h:OPEN_BTN_HEIGHT}
    }

    open_children() {
        this.children_open = !this.children_open
        const v = this.children_open
        if (v) {
            const is_many = this.children.length > 6
            for(let c of this.children) {
                c.set_visible(true)
                c.set_narrow(is_many)
            }
        }
        else                
            for(let c of this.children)
                c.set_visible_rec_children(false)
    

        do_layout(nodes_view.model, this)

    }
    open_parent() {
        this.parent_open = !this.parent_open
        const v = this.parent_open
        if (v) {
            // open just the first level of children of the parent
            this.parent.set_visible_with_children(true)
        }
        else
            this.parent.set_invisible_rec_parent(this)

        do_layout(nodes_view.model, this)
    }

    find_obj(ev) {
        if (rect_hit(ev.vx, ev.vy, this.child_open_btn()))
            return new CallHandler(()=>{this.open_children()})
        if (rect_hit(ev.vx, ev.vy, this.parent_open_btn()))
            return new CallHandler(()=>{this.open_parent()}) 
        return null
    }

    draw(ctx)
    {
        if (!this.visible)
            return
        const center = this.center()

        ctx.strokeStyle = "#444444"
        ctx.fillStyle = "#f7f7f7"
        if (this.is_narrow)
        {
            const top_y = center.y - NAR_NODE_HEIGHT/2
            const left_x = center.x - NAR_NODE_WIDTH/2
            ctx.fillRect(left_x, top_y, NAR_NODE_WIDTH, NAR_NODE_HEIGHT)
            ctx.strokeRect(left_x, top_y, NAR_NODE_WIDTH, NAR_NODE_HEIGHT)

            ctx.font = "14px Verdana"
            ctx.fillStyle = "#000000"
            ctx.fillText(this.card.name, left_x + TEXT_MARGIN.x, top_y + 4)
            ctx.fillText(this.card.title, left_x + TEXT_MARGIN.x, top_y + 19 )
        }
        else
        {
            const top_y = center.y - NODE_HEIGHT/2
            const left_x = center.x - NODE_WIDTH/2
            ctx.fillRect(left_x, top_y, NODE_WIDTH, NODE_HEIGHT)
            ctx.strokeRect(left_x, top_y, NODE_WIDTH, NODE_HEIGHT)

            ctx.font = "16px Verdana"
            ctx.fillStyle = "#000000"
            ctx.fillText(this.card.name, left_x + TEXT_MARGIN.x, top_y + TEXT_MARGIN.y)
            ctx.fillText(this.card.title, left_x + TEXT_MARGIN.x, top_y + 20 + TEXT_MARGIN.y)

            // child open button
            if (this.children.length > 0)
            {
                draw_plus_btn(ctx, this.child_open_btn(), !this.children_open)

            // lines to children
                if (this.children_open && this.children.length > 0)
                {
                    ctx.beginPath()
                    const h_line_y = center.y + LEVEL_Y_OFFSET / 2
                    ctx.moveTo(center.x, center.y + CHILD_LINE_Y_OFFS)
                    ctx.lineTo(center.x, h_line_y)
                    const c0_center = this.children[0].center(), cl_center = this.children[this.children.length - 1].center()
                    ctx.moveTo(c0_center.x, h_line_y)
                    ctx.lineTo(cl_center.x, h_line_y)
                    for(let c of this.children)
                    {
                        assert(c.visible, "unexpected invisible child")
                        const c_center = c.center()
                        ctx.moveTo(c_center.x, h_line_y)
                        ctx.lineTo(c_center.x, c_center.y - PARENT_LINE_Y_OFFS)

                    }
                    ctx.stroke()
        
                }
            }
            if (this.parent !== null)
            {
                draw_plus_btn(ctx, this.parent_open_btn(), this.parent_open)
            }            
        }



    }
}



function do_layout(model, stay_put_node)
{
    const count_narrow = (node)=>{
        node.narrow_child.count = 0
        for(let c of node.children) {
            if (c.is_narrow)
                ++node.narrow_child.count;
            count_narrow(c)
        }

        if (node.narrow_child.count == 0)
            return
        // this would produce a cube with height 3 times its width
        node.narrow_child.stack_height = Math.round(Math.sqrt(node.narrow_child.count*2))
        node.narrow_child.stack_width = Math.ceil(node.narrow_child.count / node.narrow_child.stack_height)
        let ix = 0, iy = 0
        for(let c of node.children) {
            if (!c.is_narrow) {
                c.narrow_pos.ix = 0 
                c.narrow_pos.iy = 0
                continue
            }
            c.narrow_pos.ix = ix 
            c.narrow_pos.iy = iy
            ++iy
            if (iy >= node.narrow_child.stack_height) {
                iy = 0;
                ++ix;
            }
        }
    }
    count_narrow(model.root)

    const stay_put_start = stay_put_node.center().x
    global_x_shift = 0

    const measure_width = (node)=>{
        if (!node.visible) {
            node.tree_width = 0
        }        
        if (node.narrow_child.count > 0) {
            if (node.visible) {
                if (node.children_open)
                    node.tree_width = (node.narrow_child.stack_width) * NAR_NODE_WIDTH 
                else
                    node.tree_width = NODE_WIDTH + NODE_MARGIN
            }
        }
        else {
            let sum = 0
            for(let c of node.children)
                sum += measure_width(c)
 
            if (node.visible) {
                node.tree_width = (sum == 0) ? (NODE_WIDTH + NODE_MARGIN) : sum
            }
        }
        //console.log("width " + node.card.name + " " + node.tree_width)
        return node.tree_width
    }
    //console.log("~~~~~");
    measure_width(model.root)

    const position_sib = (node)=>{

        if (node.parent === null) 
            node.sibling_x = 0
        let x = node.center().x - node.tree_width / 2

        for(let c of node.children) {
            if (c.visible) {
                if (c.is_narrow)
                    c.sibling_x = node.center().x - node.tree_width / 2 + NAR_NODE_WIDTH/2
                else {
                    c.sibling_x = x + c.tree_width / 2
                    x += c.tree_width
                }
            }
            else
                c.sibling_x = 0
            position_sib(c)
        }

    }
    position_sib(model.root)
    global_x_shift = stay_put_start - stay_put_node.center().x
    
    nodes_view.redraw()
}


const LEVEL_Y_OFFSET = 120

class Level
{
    constructor(idx, parent)
    {
        this.idx = idx
        this.parent = parent
        this.nodes = []
        this.y_offset = (idx == 0) ? -200 : LEVEL_Y_OFFSET
    }

    level_y()
    {
        let py = 0;
        if (this.parent !== null)
            py = this.parent.level_y()
        return py + this.y_offset
    }
}

class Model
{
    constructor()
    {
        this.nodes = null
        this.levels = null
        this.root = null
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
    new Card("Top Dev", "dev lead", [3, 4, 5]), //, 5
    new Card("Dev One", "developer", []),
    new Card("Dev Two", "developer", [8,9,10,11,12,13,14,15,]), //16
    new Card("Mid Man", "team lead", [6, 7]),
    new Card("Low Man", "junior dev", []),
    new Card("Low Woman", "junior dev", []),  // 7

    new Card("Pig 1", "pig", []),
    new Card("Pig 2", "pig", []),
    new Card("Pig 3", "pig", []),
    new Card("Pig 4", "big pig", []),
    new Card("Pig 5", "pig", []),
    new Card("Pig 6", "pig", []),
    new Card("Pig 7", "pig", []),
    new Card("Pig 8", "pig", []),
    //new Card("Pig 9", "pig", []),

]

function create_nodes(cards)
{
    const model = new Model()
    model.nodes = []
    let id_gen = 0
    for(let card of cards)
        model.nodes.push(new Node(card, id_gen++))
    // connect children and parent
    for(let node of model.nodes) 
    {
        let sib_idx = 0
        for(let cid of node.card.children_ids)
        {
            node.children.push(model.nodes[cid])
            model.nodes[cid].parent = model.nodes[node.id]
            model.nodes[cid].sibling_pos = sib_idx++
        }
    }
    for(let node of model.nodes) {
        if (node.parent === null) {
            ///if (model.root !== null)
            //    throw new Error("can't have more than one root")
            model.root = node
            break
        }
    }

    model.levels = []
    const set_level = (node, idx)=>{
        if (model.levels[idx] === undefined)
            model.levels[idx] = new Level(idx, (idx == 0) ? null : model.levels[idx - 1])
        node.level = model.levels[idx]
        node.level_pos = node.level.nodes.length
        node.level.nodes.push(node)
        for(let child of node.children)
            set_level(child, idx + 1)
    }
    set_level(model.root, 0)

    return model
}


let canvas_nodes = null
let nodes_view = null

function page_onload()
{
    canvas_nodes = add_elem_id(body, 'canvas', null, "canvas_nodes")
    canvas_nodes.width = 1200
    canvas_nodes.height = 800

    nodes_view = new NodesView(canvas_nodes)

    nodes_view.model = create_nodes(cards_db)
    nodes_view.model.nodes[0].set_visible(true)
   // nodes_view.model.root.center_offset = {x:0,y:-200}

    nodes_view.redraw()
    
}