

class ViewBase 
{
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.pan_x = Math.round(canvas.width/2) // default before load from state
        this.pan_y = Math.round(canvas.height/2)

        this.zoom = 1
        this.rect = null
        this.viewport_zoom = 1

        this.last_ctx_menu = null

        this.recalc_rect()
    }

    recalc_rect() {
        this.rect = this.canvas.getBoundingClientRect();
    }

    view_x(pageX) {
        return (pageX - this.rect.left)/this.zoom - this.pan_x
    }
    view_y(pageY) {
        return (pageY - this.rect.top)/this.zoom - this.pan_y
    }
    save() {
        return { pan_x:this.pan_x, pan_y:this.pan_y, zoom:this.zoom }
    }
    load(s) {
        this.pan_x = (s.pan_x === undefined || s.pan_x === null) ? 0 : parseInt(s.pan_x)
        this.pan_y = (s.pan_y === undefined || s.pan_y === null) ? 0 : parseInt(s.pan_y)
        this.zoom =  (s.zoom === undefined  || s.zoom === null) ? 1 : parseFloat(s.zoom)
    }

    dismiss_ctx_menu() {
        if (this.last_ctx_menu != null) {
            main_view.removeChild(this.last_ctx_menu)
        }
        this.last_ctx_menu = null
    }

    nodes_inputevent(name, e) {
        return false
    }
    check_rect_select() {
        return false
    }

    reset_view() {
        this.pan_x = 0
        this.pan_y = 0
        this.zoom = 1
        this.pan_redraw()
    }

    dismiss_popups() {

    }

    find_obj(ev) {
        return null
    }
    context_menu(ev) {
        return null
    }
    unselect_all(redraw=true) {
    }

    pan_redraw()
    {

    }
}

function rect_hit(ex, ey, c) {
    return ex >= c.x && ey >= c.y && ex <= c.x + c.w && ey <= c.y + c.h
}

function is_point_in_rect(x, y, rect) {
    return (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
}

function myAddEventListener(obj, event_name, func, flags=0) {
    obj.addEventListener(event_name, func)
}

function panel_mouse_control(view, canvas) 
{    
    let panning = false
    let prev_x, prev_y, down_x, down_y
    let hit = null
    let did_move = false  // used for detecting unselect
    let active_rect = null
    let node_capture = false
    
    myAddEventListener(canvas, 'mousedown', function(e) {
        //if (e.target === canvas_image && view.nodes_inputevent('mousedown', {e:e, ex:e.pageX, ey: e.pageY, buttons:e.buttons})) {
        //    node_capture = true // variable-node mouse move
        //    return
        //}
        if (e.buttons == 1) {
            if (e.ctrlKey && view.check_rect_select()) {
                active_rect = { x1:e.pageX, y1:e.pageY }
                return
            }
            prev_x = e.pageX; prev_y = e.pageY
            down_x = e.pageX; down_y = e.pageY
            const vx=view.view_x(e.pageX), vy=view.view_y(e.pageY)
            const cvs_x = e.pageX - view.rect.left, cvs_y = e.pageY - view.rect.top
            const ev = { vx:vx, vy:vy, ex:e.pageX, ey: e.pageY, cvs_x:cvs_x, cvs_y:cvs_y, e:e, ctrlKey:e.ctrlKey }
            hit = view.find_obj(ev);
            if (hit != null && hit.mousedown !== undefined) {
                //console.log("hit ", hit)
                // passing e to potentiall stop propogation
                hit.mousedown(ev)
                if (is_mousemovable(hit))
                    return  // if it can move, don't pan
            }
            did_move = false
            panning = true
            //console.log("down ", panning)
        }
    });
    myAddEventListener(canvas, 'mouseup', function(e) {
        if (panning) { // means there was no hit
            let dx = Math.abs(e.pageX - down_x)
            let dy = Math.abs(e.pageY - down_y)
            if (dx + dy < 5) { // moved only a little
                if (view.click) {
                    // don't use view_x,view_y since the panning is already take into consideration in t_inv_viewport
                    view.click(e.pageX, e.pageY) 
                }
            }
        }
    });
    myAddEventListener(document, 'mouseup', function(e) {
        panning = false;
        //console.log("up ", panning)
        if (hit !== null && hit.mouseup !== undefined)
            hit.mouseup()  // commit line pending
        else if (!did_move)
            view.unselect_all(true) // click anywhere empty, without panning, just unselects the current selection (for nodes_view)
        hit = null
        if (active_rect) {
            view.rect_select(undefined)
            active_rect = null
        }
        if (node_capture) {
            node_capture = false
            view.nodes_inputevent('mouseup', e)
        }
    });
    myAddEventListener(document, 'mousemove', function(e) {
        let dx = e.pageX - prev_x
        let dy = e.pageY - prev_y
        prev_x = e.pageX, prev_y = e.pageY
        if (dx == 0 && dy == 0) 
            return
        if (active_rect !== null) {
            let x2 = e.pageX, y2 = e.pageY
            view.rect_select(Math.min(active_rect.x1, x2), Math.min(active_rect.y1, y2),
                             Math.max(active_rect.x1, x2), Math.max(active_rect.y1, y2))
            return
        }
        did_move = true
        const edx = dx / view.viewport_zoom, edy = dy / view.viewport_zoom
        dx /= view.zoom
        dy /= view.zoom
        //console.log("move ", panning)
        if (panning) {
            view.pan_x += dx
            view.pan_y += dy
            view.pan_redraw()
        }
        else if (hit !== null && is_mousemovable(hit)) {
            let cvs_x = e.pageX - view.rect.left, cvs_y = e.pageY - view.rect.top
            const ev = {vx:view.view_x(e.pageX), vy:view.view_y(e.pageY), ex:e.pageX, ey:e.pageY, cvs_x:cvs_x, cvs_y:cvs_y,
                        shiftKey: e.shiftKey, ctrlKey:e.ctrlKey,
                        dx: edx, dy: edy}
            hit.mousemove(ev)
        }
        
        if (view.hover !== undefined) {
            let cvs_x = e.pageX - view.rect.left, cvs_y = e.pageY - view.rect.top // relative to canvas
            if (cvs_x >= 0 && cvs_y >= 0 && cvs_x < view.rect.width && cvs_y < view.rect.height) { // only if it's inside the canvas
                const ev = {vx:0, vy:0, ex:e.pageX, ey:e.pageY, cvs_x:cvs_x, cvs_y:cvs_y, buttons:e.buttons}
                view.hover(ev)
            }
        }

        //if (node_capture || is_point_in_rect(e.pageX, e.pageY, view.rect) && e.target === canvas_image) {
        //    const ev = { ex:e.pageX, ey:e.pageY, dx:edx, dy:edy, img_canvas_capture: node_capture, buttons:e.buttons }
        //    view.nodes_inputevent('mousemove', ev)
        //}
    })
    
    myAddEventListener(canvas, "contextmenu", function(e) {
        view.dismiss_ctx_menu()
        const cvs_x = e.pageX - view.rect.left, cvs_y = e.pageY - view.rect.top // relative to canvas
        const ev = { vx:view.view_x(e.pageX), vy:view.view_y(e.pageY), ex:e.pageX, ey:e.pageY, cvs_x:cvs_x, cvs_y:cvs_y }
        let ctx = view.context_menu(ev)
        if (ctx !== null)
            e.preventDefault()
        return false;
    })
    myAddEventListener(document, 'mousedown', function(e) {
        view.dismiss_ctx_menu()
        view.dismiss_popups()
    })

    myAddEventListener(document, 'mousewheel', function(e) { // don't keep boxes one while zooming
        view.dismiss_ctx_menu()
        view.dismiss_popups()
    })
}

function is_mousemovable(hit) {
    if (hit.mousemovable !== undefined)
        return hit.mousemovable()
    return hit.mousemove !== undefined
}

// https://github.com/jackmoore/wheelzoom/blob/master/wheelzoom.js
function panel_mouse_wheel(view, canvas)
{
    const zoom_factor = 1.10

    function onWarCanvasWheel(e) 
    {
        let bgPosX = view.pan_x * view.zoom
        let bgPosY = view.pan_y * view.zoom

        e.preventDefault();
        let deltaY = 0;
        if (e.deltaY) { // FireFox 17+ (IE9+, Chrome 31+?)
            deltaY = e.deltaY;
        } else if (e.wheelDelta) {
            deltaY = -e.wheelDelta;
        }

        let rect = canvas.getBoundingClientRect();
        let offsetX = e.pageX - rect.left - window.pageXOffset;
        let offsetY = e.pageY - rect.top - window.pageYOffset;
        // Record the offset between the bg edge and cursor:
        //  from corner to cursor
        let bgCursorX = offsetX - bgPosX;
        let bgCursorY = offsetY - bgPosY;
        // Use the previous offset to get the percent offset between the bg edge and cursor:
        let bgRatioX = bgCursorX/view.zoom;
        let bgRatioY = bgCursorY/view.zoom;
        // Update the bg size:
        if (deltaY < 0) {
            view.zoom *= zoom_factor;
        } else {
            view.zoom /= zoom_factor;
        }

        // Take the percent offset and apply it to the new size:
        //  from cursor back to corner
        bgPosX = offsetX - (view.zoom * bgRatioX);
        bgPosY = offsetY - (view.zoom * bgRatioY);

        view.pan_x = bgPosX / view.zoom // don't know...
        view.pan_y = bgPosY / view.zoom

        view.pan_redraw()

    }
    myAddEventListener(canvas, "wheel", onWarCanvasWheel)    
}

