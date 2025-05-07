// 获取当前浏览器地址栏的查询参数
const queryParams = new URLSearchParams(window.location.search);
var my_name = queryParams.get('my_name');

//var
if(!my_name){
    var my_name = prompt("Name:");
}
var my_peerid
var my_info
var my_msg = "Hello!"
var timer = 0

//AFRAME functions
AFRAME.registerComponent("player", {
    init: function () {
        console.log(my_name + " login!");
        color = document.getElementById("color-picker").style.backgroundColor.replace(/(?:\(|\)|rgb|RGB)*/g, '').split(',');
        var R = Number(color[0]).toString(16).padStart(2, '0');
        var G = Number(color[1]).toString(16).padStart(2, '0');
        var B = Number(color[2]).toString(16).padStart(2, '0');
        document.getElementById("my_ball").setAttribute("color", "#" + R + G + B);
        document.getElementById("my_name").textContent = my_name
        document.getElementById("my_name_plate").setAttribute("value", my_name);
        document.getElementById("my_msg_plate").setAttribute("value", my_msg);
        this.previousPosition = new THREE.Vector3(); // 前回の位置を格納するためのVector3オブジェクトを作成する
        this.my_rot_last = {x:0,y:0}
    },
    tick: function () {

        let my_ball = document.getElementById("my_ball");
        let my_color = my_ball.getAttribute("color");
        let my_msg = document.getElementById("my_msg").innerText
        let my_name = document.getElementById("my_name").innerText
        let my_pos = {
            x: parseFloat(this.el.object3D.position.x.toFixed(3)),
            y: parseFloat(this.el.object3D.position.y.toFixed(3)),
            z: parseFloat(this.el.object3D.position.z.toFixed(3))
        };
        //console.log(my_pos)
        let my_rot = {
            x: this.el.components["look-controls"].pitchObject.rotation.x * 180 / Math.PI,
            y: this.el.components["look-controls"].yawObject.rotation.y * 180 / Math.PI
        }

        
        my_ui.setAttribute("position", my_pos.x + " " + 1 + " " + my_pos.z)
        my_ui.setAttribute("rotation", 0 + " " + my_rot.y + " " + 0)


        let positionChange = this.el.object3D.position.distanceTo(this.previousPosition); // 位置の変化量を計算する
        // console.warn(positionChange)
        let rotationChangeX = Math.abs(my_rot.x - this.my_rot_last.x)
        let rotationChangeY = Math.abs(my_rot.y - this.my_rot_last.y)

        // if(rotationChangeX>0.01)console.warn(rotationChangeX)
        // if(rotationChangeY>0.01)console.warn(rotationChangeY)
        


        // if ((JSON.stringify(my_info) !== JSON.stringify([my_peerid, my_color, my_name, my_pos, my_msg, my_rot])) || timer >= 500) {
        if (positionChange >0.1 || rotationChangeX >0.01 || rotationChangeY>0.01 || timer >= 500) {            
            //console.log(my_rot)
            this.previousPosition.copy(this.el.object3D.position)
            this.my_rot_last = Object.assign({}, my_rot);
            my_info = [my_peerid, my_color, my_name, my_pos, my_msg, my_rot]
            socket.emit("seed_my_info_to_server", my_info);
            timer = 0
            //console.log("变了",my_info,[my_peerid,my_color, my_name, my_pos,my_msg])
        } else {
            timer++;
            //console.log("未变化", my_info, [my_peerid,my_color, my_name, my_pos,my_msg]);
        }
    },
});
