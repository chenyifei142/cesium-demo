/**
 * 气泡窗类
 * @class
 *
 */
class Prompt {
    /**
     * @param {Cesium.Viewer} viewer 地图viewer对象
     * @param {Object} opt
     * @param {Cesium.Cartesian3 | Array} [opt.position] 弹窗坐标 （type=2时生效）
     * @param {Boolean} opt.show 是否显示
     * @param {Function} [opt.success] 创建成功的回调函数
     * @param {Number} [opt.type=1] 1~位置变化提示框 / 2~固定坐标提示框
     * @param {Cesium.Cartesian3 | Array} opt.position 固定坐标提示框的坐标（ cartesian3 / [101,30] ），type为1时，可不设置此参数
     * @param {Boolean} [opt.anchor=true] 是否显示锚点
     * @param {Boolean} [opt.closeBtn=true] 是否显示关闭按钮
     * @param {String} opt.className 自定义class
     * @param {String} opt.content 弹窗内容
     * @param {Function} [opt.close] 关闭弹窗时的回调函数
     * @param {Object} [opt.offset] 偏移参数
     * @param {Number} [opt.offset.x] 横坐标偏移像素单位
     * @param {Number} [opt.offset.y] 纵坐标偏移像素单位
     * @param {Object} [opt.style] 弹窗面板样式
     * @param {String} [opt.style.background='white'] 背景色
     * @param {String} [opt.style.boxShadow] 弹窗阴影（css属性）
     * @param {String} [opt.style.color] 弹窗颜色
     *
     */
    constructor(viewer, opt) {
        this.viewer = viewer;
        if (!this.viewer) return;
        this.type = "prompt";
        // 默认值
        opt = opt || {};
        const promptType = opt.type == undefined ? 1 : opt.type;
        let defaultOpt = {
            id: (new Date().getTime() + "" + Math.floor(Math.random() * 10000)),
            type: promptType,
            anchor: promptType == 2 ? true : false,
            closeBtn: promptType == 2 ? true : false,
            offset: promptType == 2 ? { x: 0, y: -20 } : { x: 10, y: 10 },
            content: "",
            show: true,
            style: {
                background: "rgba(0,0,0,0.5)",
                color: "white"
            }
        }

        this.opt = Object.assign(defaultOpt, opt);

        /**
         * @property {Object} attr 相关属性
         */
        this.attr = this.opt;
        // ====================== 创建弹窗内容 start ======================
        const mapid = this.viewer.container.id;

        /**
         * @property {Boolearn} isShow 当前显示状态
         */
        this.isShow = this.opt.show == undefined ? true : this.opt.show; // 是否显示
        let anchorHtml = ``;
        let closeHtml = ``;
        const background = this.opt.style.background;
        const color = this.opt.style.color;
        if (this.opt.anchor) {
            anchorHtml += `
            <div class="prompt-anchor-container">
                <div class="prompt-anchor" style="background:${background} !important;">
                </div>
            </div>
            `;
        }
        if (this.opt.closeBtn) { // 移动提示框 不显示关闭按钮
            closeHtml = `<a class="prompt-close" attr="${this.opt.id}" id="prompt-close-${this.opt.id}">x</a>`;
        }
        let boxShadow = this.opt.style.boxShadow;
        const promptId = "prompt-" + this.opt.id;
        const promptConenet = `
                <!-- 文本内容 -->
                <div class="prompt-content-container" style="background:${background} !important;color:${color} !important;box-shadow:${boxShadow} !important">
                    <div class="prompt-content" id="prompt-content-${this.opt.id}">
                        ${this.opt.content}
                    </div>
                </div>
                <!-- 锚 -->
                ${anchorHtml}
                <!-- 关闭按钮 -->
                ${closeHtml}
        `;
        // 构建弹窗元素
        this.promptDiv = window.document.createElement("div");
        this.promptDiv.className = `easy3d-prompt ${this.opt.className}`;
        this.promptDiv.id = promptId;
        this.promptDiv.innerHTML = promptConenet;
        let mapDom = window.document.getElementById(mapid);
        mapDom.appendChild(this.promptDiv);
        const clsBtn = window.document.getElementById(`prompt-close-${this.opt.id}`);
        let that = this;
        if (clsBtn) {
            clsBtn.addEventListener("click", (e) => {
                that.hide();
                if (that.opt.close) that.opt.close();
            })
        }

        /**
         * @property {Object} promptDom 弹窗div
         */
        this.promptDom = window.document.getElementById(promptId);

        this.position = this.transPosition(this.opt.position);
        // ====================== 创建弹窗内容 end ======================

        if (promptType == 2) this.bindRender(); // 固定位置弹窗 绑定实时渲染 当到地球背面时 隐藏
        if (this.opt.show == false) this.hide();
        this.containerW = this.viewer.container.offsetWidth;
        this.containerH = this.viewer.container.offsetHeight;
        this.containerLeft = this.viewer.container.offsetLeft;
        this.containerTop = this.viewer.container.offsetTop;

        /**
         * @property {Number} contentW 弹窗宽度
         */
        this.contentW = Math.ceil(Number(this.promptDom.offsetWidth)); // 宽度

        /**
         * @property {Number} contentH 弹窗高度
         */
        this.contentH = this.promptDom.offsetHeight; // 高度

        if (this.opt.success) this.opt.success();
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.promptDiv) {
            window.document.getElementById(this.viewer.container.id).removeChild(this.promptDiv);
            this.promptDiv = null;
        }
        if (this.rendHandler) {
            this.rendHandler();
            this.rendHandler = null;
        }
    }
    // 实时监听
    bindRender() {
        let that = this;
        this.rendHandler = this.viewer.scene.postRender.addEventListener(function () {
            if (!that.isShow && that.promptDom) {
                that.promptDom.style.display = "none";
                return;
            }
            if (!that.position) return;
            if (that.position instanceof Cesium.Cartesian3) {
                let px = Cesium.SceneTransforms.wgs84ToWindowCoordinates(that.viewer.scene, that.position);
                if (!px) return;
                const occluder = new Cesium.EllipsoidalOccluder(that.viewer.scene.globe.ellipsoid, that.viewer.scene.camera.position);
                // 当前点位是否可见 是否在地球背面
                const res = occluder.isPointVisible(that.position);
                if (res) {
                    if (that.promptDom) that.promptDom.style.display = "block";
                } else {
                    if (that.promptDom) that.promptDom.style.display = "none";
                }
                that.setByPX({
                    x: px.x,
                    y: px.y
                });
            } else {
                that.setByPX({
                    x: that.position.x,
                    y: that.position.y
                });
            }

        }, this);
    }

    /**
     *
     * @param {Cesium.Cartesian3 | Object} px 弹窗坐标
     * @param {String} html 弹窗内容
     */
    update(px, html) {
        if (px instanceof Cesium.Cartesian3) {
            this.position = px.clone();
            px = Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, px);
        }
        this.contentW = Math.ceil(Number(this.promptDom.offsetWidth)); // 宽度
        this.contentH = this.promptDom.offsetHeight; // 高度
        if (px) this.setByPX(px);
        if (html) this.setContent(html);
    }

    // 判断是否在当前视野内
    isInView() {
        if (!this.position) return false;
        let px = null;
        if (this.position instanceof Cesium.Cartesian2) {
            px = this.position;
        } else {
            px = Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, this.position);
        }
        const occluder = new Cesium.EllipsoidalOccluder(this.viewer.scene.globe.ellipsoid, this.viewer.scene.camera.position);
        // 是否在地球背面
        const res = occluder.isPointVisible(this.position);
        let isin = false;
        if (!px) return isin;
        if (
            px.x > this.containerLeft &&
            px.x < (this.containerLeft + this.containerW) &&
            px.y > this.containerTop &&
            px.y < (this.containerTop + this.containerH)
        ) {
            isin = true;
        }
        return res && isin;
    }

    /**
     * 是否可见
     * @param {Boolean} isShow true可见，false不可见
     */
    setVisible(isShow) {
        let isin = this.isInView(this.position);
        if (isin && isShow) {
            this.isShow = true;
            if (this.promptDom) this.promptDom.style.display = "block";
        } else {
            this.isShow = false;
            if (this.promptDom) this.promptDom.style.display = "none";
        }
    }

    /**
     * 显示
     */
    show() {
        this.setVisible(true);
    }

    /**
     * 隐藏
     */
    hide() {
        this.setVisible(false);
    }

    /**
     * 设置弹窗内容
     * @param {String} content 内容
     */
    setContent(content) {
        let pc = window.document.getElementById(`prompt-content-${this.opt.id}`);
        pc.innerHTML = content;
    }

    /**
     * 设置弹窗坐标
     * @param {Object} opt 屏幕坐标
     */
    setByPX(opt) {
        if (!opt) return;
        if (this.promptDom) {
            const contentW = this.promptDom.offsetWidth; // 宽度
            const contentH = this.promptDom.offsetHeight; // 高度
            if (this.opt.type == 1) {
                this.promptDom.style.left = ((Number(opt.x) + Number(this.opt.offset.x || 0))) + "px";
                this.promptDom.style.top = ((Number(opt.y) + Number(this.opt.offset.y || 0))) + "px";
            } else {
                this.promptDom.style.left = ((Number(opt.x) + Number(this.opt.offset.x || 0)) - Number(this.contentW) / 2) + "px";
                this.promptDom.style.top = ((Number(opt.y) + Number(this.opt.offset.y || 0)) - Number(this.contentH)) + "px";
            }
        }
    }

    // 坐标转换
    transPosition(p) {
        let position;
        if (Array.isArray(p)) {
            const posi = Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0);
            position = posi.clone();
        } else if (p instanceof Cesium.Cartesian3) {
            position = p.clone();
        } else { // 像素类型
            position = p;
        }
        return position;
    }
}
/**
 * 三维基础方法
 * @example util.getCameraView(viewer);
 * @exports util
 * @alias util
 */
let util = {};
/**
 * 世界坐标转经纬度
 * @param {Cesium.Cartesian3 } cartesian 世界坐标
 * @param {Cesium.Viewer} viewer 当前viewer对象
 * @returns { Array } 经纬度坐标s
 */
util.cartesianToLnglat = function (cartesian, viewer) {
    if (!cartesian) return [];
    viewer = viewer || window.viewer;
    var lnglat = Cesium.Cartographic.fromCartesian(cartesian);
    var lat = Cesium.Math.toDegrees(lnglat.latitude);
    var lng = Cesium.Math.toDegrees(lnglat.longitude);
    var hei = lnglat.height;
    return [lng, lat, hei];
}

util.getViewCenter = (viewer) => {
    if (!viewer) return;
    var rectangle = viewer.camera.computeViewRectangle();
    var west = rectangle.west / Math.PI * 180;
    var north = rectangle.north / Math.PI * 180;
    var east = rectangle.east / Math.PI * 180;
    var south = rectangle.south / Math.PI * 180;
    return [(east + west) / 2, (north + south) / 2]
}

/**
 * 世界坐标数组转经纬度数组
 * @param {Cesium.Cartesian3[]} cartesians 世界坐标数组
 * @param {Cesium.Viewer} viewer 当前viewer对象
 * @returns { Array } 经纬度坐标数组
 */
util.cartesiansToLnglats = function (cartesians, viewer) {
    if (!cartesians || cartesians.length < 1) return;
    viewer = viewer || window.viewer;
    if (!viewer) {
        console.log('util.cartesiansToLnglats方法缺少viewer对象');
        return;
    }
    var arr = [];
    for (var i = 0; i < cartesians.length; i++) {
        arr.push(util.cartesianToLnglat(cartesians[i], viewer));
    }
    return arr;
}

/**
 * 经纬度坐标数组转世界坐标数组
 * @param {Array[]} lnglats 经纬度坐标数组
 * @returns {Cesium.Cartesian3[]} cartesians 世界坐标数组
 * @example util.lnglatsToCartesians([[117,40],[118.41]])
 */
util.lnglatsToCartesians = function (lnglats) {
    if (!lnglats || lnglats.length < 1) return;
    var arr = [];
    for (var i = 0; i < lnglats.length; i++) {
        var c3 = Cesium.Cartesian3.fromDegrees(lnglats[i][0], lnglats[i][1], lnglats[i][2] || 0);
        arr.push(c3);
    }
    return arr;
}

/**
 * 视角定位方法
 * @param {Object} opt 定位参数
 * @param {Cartesian3|Array} opt.center 当前定位中心点
 * @param {Number} opt.heading 当前定位偏转角度 默认为0
 * @param {Number} opt.pitch 当前定位仰俯角 默认为-60
 * @param {Number} opt.range 当前定位距离 默认为1000米
 * @param {Cesium.Viewer} viewer 当前viewer对象
 */
util.flyTo = function (opt, viewer) {
    if (!viewer) {
        console.log('util.flyTo缺少viewer对象');
        return;
    }
    opt = opt || {};
    let center = opt.center;
    if (!center) {
        console.log("缺少定位坐标！");
        return;
    }
    if (center instanceof Cesium.Cartesian3) {
        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center), {
            offset: new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(opt.heading || 0),
                Cesium.Math.toRadians(opt.pitch || -60),
                opt.range || 10000
            )
        });
    }
    if (center instanceof Array) {
        var boundingSphere = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(center[0], center[1], center[2]));
        viewer.camera.flyToBoundingSphere(boundingSphere, {
            offset: new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(opt.heading || 0),
                Cesium.Math.toRadians(opt.pitch || -60),
                opt.range || 10000
            )
        });
    }
}

/**
 * 获取当相机姿态
 * @param {Cesium.Viewer} viewer 当前viewer对象
 * @returns {Object} cameraView 当前相机姿态
 */
util.getCameraView = function (viewer) {
    viewer = viewer || window.viewer;
    if (!viewer) {
        console.log('util.getCameraView缺少viewer对象');
        return;
    }
    var camera = viewer.camera;
    var position = camera.position;
    var heading = camera.heading;
    var pitch = camera.pitch;
    var roll = camera.roll;
    var lnglat = Cesium.Cartographic.fromCartesian(position);

    var cameraV = {
        "x": Cesium.Math.toDegrees(lnglat.longitude),
        "y": Cesium.Math.toDegrees(lnglat.latitude),
        "z": lnglat.height,
        "heading": Cesium.Math.toDegrees(heading),
        "pitch": Cesium.Math.toDegrees(pitch),
        "roll": Cesium.Math.toDegrees(roll)
    };
    return cameraV;
}

/**
 * 设置相机姿态 一般和getCameraView搭配使用
 * @param {Object} cameraView 相机姿态参数
 * @param {Number} cameraView.duration 定位所需时间
 * @param {Cesium.Viewer} viewer 当前viewer对象
 */
util.setCameraView = function (obj, viewer) {
    viewer = viewer || window.viewer;
    if (!viewer) {
        console.log('util.setCameraView缺少viewer对象');
        return;
    }
    if (!obj) return;
    var position = obj.destination || Cesium.Cartesian3.fromDegrees(obj.x, obj.y, obj.z); // 兼容cartesian3和xyz
    viewer.camera.flyTo({
        destination: position,
        orientation: {
            heading: Cesium.Math.toRadians(obj.heading || 0),
            pitch: Cesium.Math.toRadians(obj.pitch || 0),
            roll: Cesium.Math.toRadians(obj.roll || 0)
        },
        duration: obj.duration === undefined ? 3 : obj.duration,
        complete: obj.complete
    });
}

/**
 * 计算当前三角形面积
 * @param {Cesium.Cartesian3 } pos1 当前点坐标1
 * @param {Cesium.Cartesian3 } pos2 当前点坐标2
 * @param {Cesium.Cartesian3 } pos3 当前点坐标3
 * @returns {Number} area，面积
 */
util.computeAreaOfTriangle = function (pos1, pos2, pos3) {
    if (!pos1 || !pos2 || !pos3) {
        console.log("传入坐标有误！");
        return 0;
    }
    var a = Cesium.Cartesian3.distance(pos1, pos2);
    var b = Cesium.Cartesian3.distance(pos2, pos3);
    var c = Cesium.Cartesian3.distance(pos3, pos1);
    var S = (a + b + c) / 2;
    return Math.sqrt(S * (S - a) * (S - b) * (S - c));
}



/**
 * 标绘基类
 * @description 标绘基类，一般不直接实例化，而实例化其子类（见下方Classes）
 * @class
 * @alias BasePlot
 */
class BasePlot {
    /**
     * @param {Cesium.Viewer} viewer 地图viewer对象
     * @param {Object} style 样式属性
     */
    constructor(viewer, style) {
        this.viewer = viewer;

        /**
         * @property {Object} style 样式
         */
        this.style = style || {};

        /**
         * @property {String | Number} objId 唯一id
         */
        this.objId = Number((new Date()).getTime() + "" + Number(Math.random() * 1000).toFixed(0));
        this.handler = undefined;
        this.modifyHandler = undefined;

        /**
         * @property {String} type 类型
         */
        this.type = '';
        /**
         *@property {Cesium.Cartesian3[]} positions 坐标数组
         */
        this.positions = [];

        /**
         *@property {String} state 标识当前状态 no startCreate creating endCreate startEdit endEdit editing
         */
        this.state = null;  //

        /**
         * @property {Object} prompt 鼠标提示框
         */
        this.prompt = null; // 初始化鼠标提示框
        this.controlPoints = []; // 控制点
        this.modifyPoint = null;

        /**
         * 图标entity对象
         * @property {Cesium.Entity} entity entity对象
         */

        this.entity = null;
        this.pointStyle = {};

        /**
         * @property {Object} promptStyle 鼠标提示框样式
         */
        this.promptStyle = this.style.prompt || {
            show: true
        }
        this.properties = {};

        // 缩放分辨率比例
        this.clientScale = 1;
    }

    /**
     *
     * @param {Object} px 像素坐标
     * @returns {Cesium.Cartesian3} 世界坐标
     */
    getCatesian3FromPX(px) {
        px = this.transpx(px); // 此处单独解决了地图采点的偏移  prompt的偏移暂未处理
        let picks = this.viewer.scene.drillPick(px);
        this.viewer.scene.render();
        let cartesian;
        let isOn3dtiles = false;
        for (let i = 0; i < picks.length; i++) {
            if ((picks[i] && picks[i].primitive) && picks[i].primitive instanceof Cesium.Cesium3DTileset) { //模型上拾取
                isOn3dtiles = true;
                break;
            }
        }
        if (isOn3dtiles) {
            cartesian = this.viewer.scene.pickPosition(px);
        } else {
            let ray = this.viewer.camera.getPickRay(px);
            if (!ray) return null;
            cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        }
        return cartesian;
    }

    /**
     *  此方法用于 地图界面缩放问题（transform:translate(2)）
     * @param {Number} scale 缩放比例
     */
    setClientScale(scale) {
        scale = scale || 1;
        this.clientScale = scale;
    }

    transpx(px) {
        return {
            x: px.x / (this.clientScale || 1),
            y: px.y / (this.clientScale || 1)
        }
    }

    /**
     *
     * @returns {Cesium.Entity} 实体对象
     */
    getEntity() {
        return this.entity;
    }

    /**
     *
     * @param {Boolean} isWgs84 是否转化为经纬度
     * @returns {Array} 坐标数组
     */
    getPositions(isWgs84) {
        return isWgs84 ? util.cartesiansToLnglats(this.positions, this.viewer) : this.positions;
    }

    /**
     * 获取经纬度坐标
     * @returns {Array} 经纬度坐标数组
     */
    getLnglats() {
        return util.cartesiansToLnglats(this.positions, this.viewer);
    }

    /**
     * 设置自定义属性
     * @param {Object} prop 属性
     */
    setOwnProp(prop) {
        if (this.entity) this.entity.ownProp = prop;
    }

    /**
     * 移除当前entity对象
     */
    remove() {
        if (this.entity) {
            this.state = "no";
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
    }

    /**
     * 设置entity对象的显示隐藏
     * @param {Boolean} visible
     */
    setVisible(visible) {
        if (this.entity) this.entity.show = visible;
    }

    // 操作控制
    forbidDrawWorld(isForbid) {
        this.viewer.scene.screenSpaceCameraController.enableRotate = !isForbid;
        this.viewer.scene.screenSpaceCameraController.enableTilt = !isForbid;
        this.viewer.scene.screenSpaceCameraController.enableTranslate = !isForbid;
        this.viewer.scene.screenSpaceCameraController.enableInputs = !isForbid;
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.handler) {
            this.handler.destroy();
            this.handler = null;
        }
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
        }
        if (this.entity) {
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }

        this.positions = [];
        this.style = null;
        for (var i = 0; i < this.controlPoints.length; i++) {
            var point = this.controlPoints[i];
            this.viewer.entities.remove(point);
        }
        this.controlPoints = [];
        this.modifyPoint = null;
        if (this.prompt) {
            this.prompt.destroy();
            this.prompt = null;
        }
        this.state = "no";
        this.forbidDrawWorld(false);
    }

    /**
     *
     * 开始编辑
     */
    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity) return;
        this.state = "startEdit";;
        if (!this.modifyHandler) this.modifyHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        let that = this;
        for (let i = 0; i < that.controlPoints.length; i++) {
            let point = that.controlPoints[i];
            if (point) point.show = true;
        }
        this.entity.show = true;

        this.modifyHandler.setInputAction(function (evt) {
            if (!that.entity) return;
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                if (!pick.id.objId)
                    that.modifyPoint = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (that.positions.length < 1 || !that.modifyPoint) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, [that.entity, that.modifyPoint]);
            if (cartesian) {
                that.modifyPoint.position.setValue(cartesian);
                that.positions[that.modifyPoint.wz] = cartesian;
                that.state = "editing";
                if (callback) callback();
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!that.modifyPoint) return;
            that.modifyPoint = null;
            that.forbidDrawWorld(false);
            that.state = "editing";
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    /**
     * 结束编辑
     * @param {Function} callback 回调函数
     * @example
     *  plotObj.endEdit(function(entity){})
     */
    endEdit(callback) {
        for (let i = 0; i < this.controlPoints.length; i++) {
            let point = this.controlPoints[i];
            if (point) point.show = false;
        }
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }

    /**
     * 结束创建
     */
    endCreate() {

    }

    /**
     * 在当前步骤结束
     */
    done() {

    }


    // 构建控制点
    createPoint(position) {
        if (!position) return;
        this.pointStyle.color = this.pointStyle.color || Cesium.Color.CORNFLOWERBLUE;
        this.pointStyle.outlineColor = this.pointStyle.color || Cesium.Color.CORNFLOWERBLUE;

        let color = this.pointStyle.color instanceof Cesium.Color ? this.pointStyle.color : Cesium.Color.fromCssColorString(this.pointStyle.color);
        color = color.withAlpha(this.pointStyle.colorAlpha || 1);

        let outlineColor = this.pointStyle.outlineColor instanceof Cesium.Color ? this.pointStyle.outlineColor : Cesium.Color.fromCssColorString(this.pointStyle.outlineColor);
        outlineColor = outlineColor.withAlpha(this.pointStyle.outlineColorAlpha || 1);

        return this.viewer.entities.add({
            position: position,
            point: {
                color: Cesium.Color.SKYBLUE,
                pixelSize: 10,
                outlineColor: Cesium.Color.YELLOW,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            show: false
        });
    }

    // 获取当前标绘的样式
    /*  getStyle() {
      if (!this.entity) return;
      let graphic = this.entity[this.plotType];
      if (!graphic) return;
      let style = {};
      switch (this.plotType) {
          case 'polyline':
              style.clampToGround = graphic.clampToGround._value; // 是否贴地
              style.distanceDisplayCondition = graphic.distanceDisplayCondition._value; // 显示控制
              style.width = graphic.width._value; // 线宽
              let colorObj = this.transfromLineMaterial(graphic.material);
              style = Object.assign(style, colorObj);
              break;
          case "polygon":
              style.heightReference = graphic.heightReference.getValue();
              style.fill = graphic.fill._value;
              style.extrudedHeight = graphic.extrudedHeight._value;
              let gonColorObj = this.transfromGonMaterial(graphic.material);
              style = Object.assign(style, gonColorObj);

              style.outline = graphic.outline._value;
              let ocv = graphic.outlineColor.getValue();
              style.outlineColorAlpha = ocv.alpha;
              style.outlineColor = new Cesium.Color(ocv.red, ocv.green, ocv.blue, 1).toCssHexString();

              break;
          default:
              break;
      }
      return style;
  } */

    // 获取线的材质
    transfromLineMaterial(material) {
        if (!material) return;
        let colorObj = {};
        if (material instanceof Cesium.Color) {
            let colorVal = material.color.getValue();
            colorObj.colorAlpha = colorVal.alpha;
            // 转为hex
            colorObj.colorHex = new Cesium.Color(colorVal.red, colorVal.green, colorVal.blue, 1).toCssHexString();
        }
        return colorObj;
    }

    // 获取面材质
    transfromGonMaterial(material) {
        if (!material) return;
        let colorObj = {};
        if (material instanceof Cesium.Color) {
            let colorVal = material.color.getValue();
            colorObj.colorAlpha = colorVal.alpha;
            // 转为hex
            colorObj.colorHex = new Cesium.Color(colorVal.red, colorVal.green, colorVal.blue, 1).toCssHexString();
        }
        return colorObj;
    }

    // 设置实体的属性
    setAttr(attr) {
        this.properties.attr = attr || {};
    }

    getAttr(){
        return this.properties.attr;
    }

    /**
     * 缩放至当前绘制的对象
     */
    zoomTo() {
        if (this.entity) {
            this.viewer.zoomTo(this.entity);
        }
    }


}



/**
 * 图标标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreateBillboard
 */
class CreateBillboard extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);

        this.type = "billboard";
        this.viewer = viewer;
        let defaultStyle = {
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1
        }
        this.style = Object.assign({}, defaultStyle, style || {});

        this.entity = null;
        if (!this.style.hasOwnProperty("image")) {
            console.log("未设置billboard的参数！");
        }

        /**
         * @property {Cesium.Cartesian3} 图标坐标
         */
        this.position = null;
    }

    /**
     * 开始绘制
     * @param {Function} callback 绘制成功后回调函数
     */
    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer);
            if (!cartesian) return;
            that.position = cartesian.clone();
            that.entity = that.createBillboard(that.position);
            if (that.handler) {
                that.handler.destroy();
                that.handler = null;
            }
            if (that.prompt) {
                that.prompt.destroy();
                that.prompt = null;
            }
            that.state = "endCreate";
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            that.prompt.update(evt.endPosition, "单击新增");
            that.state = "creating";
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    /**
     * 结束绘制
     * @param {Function} callback 结束绘制后回调函数
     */
    endCreate() {
        let that = this;
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
        that.state = "endCreate";
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    /**
     * 通过坐标数组构建
     * @param {Array} lnglatArr 经纬度坐标数组
     * @callback {Function} callback 绘制成功后回调函数
     */
    createByPositions(lnglatArr, callback) {
        if (!lnglatArr) return;
        this.state = "startCreate";
        let position = null;
        if (lnglatArr instanceof Cesium.Cartesian3) {
            position = lnglatArr.clone();
        } else {
            position = Cesium.Cartesian3.fromDegrees(Number(lnglatArr[0]), Number(lnglatArr[1]), Number(lnglatArr[2] || 0));
        }

        if (!position) return;
        this.position = position.clone();
        this.entity = this.createBillboard(this.position);
        if (callback) callback(this.entity);
        this.state = "endCreate";
    }

    /**
     * 设置相关样式
     * @param {Object} style 样式
     */
    setStyle(style) {
        if (!style) return;
        let billboard = this.entity.billboard;
        if (style.image != undefined) billboard.image = style.image;
        if (style.heightReference != undefined) {
            let heightReference = 1;
            if (this.style.heightReference == true) {
                heightReference = 1;
            } else {
                heightReference = this.style.heightReference;
            }
            billboard.heightReference = heightReference;
        }
        if (style.heightReference != undefined)
            billboard.heightReference = (style.heightReference == undefined ? 1 : Number(this.style.heightReference)); // 如果直接设置为true 会导致崩溃
        if (style.scale != undefined) billboard.scale = Number(style.scale);
        if (style.color) {
            let color = style.color instanceof Cesium.Color ? style.color : Cesium.Color.fromCssColorString(style.color);
            color = color.withAlpha(style.colorAlpha || 1);
            billboard.color = color;
        }
        this.style = Object.assign(this.style, style);
    }

    /**
     * 获取样式
     * @returns {Object} 样式
     */
    getStyle() {
        let obj = {};
        let billboard = this.entity.billboard;
        obj.image = this.style.image;
        if (billboard.heightReference) {
            let heightReference = billboard.heightReference.getValue();
            obj.heightReference = Number(heightReference);
        }
        obj.scale = billboard.scale.getValue();

        if (billboard.color) {
            let color = billboard.color.getValue();
            obj.colorAlpha = color.alpha;
            obj.color = new Cesium.Color(color.red, color.green, color.blue, 1).toCssHexString();
        }
        return obj;
    }

    /**
     * 开始编辑
     */
    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity) return;
        this.state = "startEdit";
        if (!this.modifyHandler) this.modifyHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        let that = this;
        let editBillboard;
        this.modifyHandler.setInputAction(function (evt) {
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                editBillboard = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) { //移动时绘制线
            if (!editBillboard) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer);
            if (!cartesian) return;
            editBillboard.position.setValue(cartesian.clone());
            that.position = cartesian.clone();
            that.state = "editing";
            if(callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) { //移动时绘制线
            if (!editBillboard) return;
            that.forbidDrawWorld(false);
            if (that.modifyHandler) {
                that.modifyHandler.destroy();
                that.modifyHandler = null;
                that.state = "editing";
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    /**
     * 结束编辑
     * @param {Function} callback 回调函数
     */
    endEdit(callback) {
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.state = "endEdit";
    }
    createBillboard(cartesian) {
        if (!cartesian) return;
        let billboard = this.viewer.entities.add({
            position: cartesian,
            billboard: {
                color: this.style.color ? (this.style.color instanceof Cesium.Color ? this.style.color : Cesium.Color.fromCssColorString(this.style.color).withAlpha(this.style.colorAlpha || 1)) : Cesium.Color.WHITE,
                image: this.style.image || "../img/mark4.png",
                scale: this.style.scale || 1,
                pixelOffset: this.style.pixelOffset,
                heightReference: this.style.heightReference == undefined ? 1 : Number(this.style.heightReference),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            }
        })
        billboard.objId = this.objId;
        return billboard;
    }

    /**
     * 移除
     */
    remove() {
        if (this.entity) {
            this.state = "no";
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
    }


    getPositions(isWgs84) {
        return isWgs84 ? util.cartesianToLnglat(this.position, this.viewer) : this.position;
    }
    getLnglats(){
        return this.getPositions(true);
    }
    /**
     * 设置图标坐标
     * @param {Cesium.Cartesian3 | Array} p 坐标
     */
    setPosition(p) {
        let position = null;
        if (p instanceof Cesium.Cartesian3) {
            position = p;
        } else {
            position = Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0);
        }
        this.entity.position.setValue(position.clone());
        this.position = position.clone();
    }

}
/**
 * 圆标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreateCircle
 */
class CreateCircle extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "circle";
        this.objId = Number(
            new Date().getTime() + "" + Number(Math.random() * 1000).toFixed(0)
        );
        this.viewer = viewer;
        this.style = style;
        this.floatPoint = null;

        /**
         * @property {Cesium.Entity} centerPoint 圆中心点
         */
        this.centerPoint = null;

        /**
         * @property {Cesium.Cartesian3} position 圆中心点坐标
         */
        this.position = null;
        this.floatPosition = null;

        /**
         * @property {Number} 圆半径
         */
        this.radius = 0.001;
        this.modifyPoint = null;
        this.pointArr = [];
    }

    /**
     * 开始绘制
     * @param {Function} callback 绘制成功后回调函数
     */
    start(callback) {
        if (!this.prompt && this.promptStyle.show)
            this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) {
            //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer);
            if (!cartesian) return;
            if (!that.centerPoint) {
                that.position = cartesian;
                that.centerPoint = that.createPoint(cartesian);
                that.centerPoint.typeAttr = "center";

                that.floatPoint = that.createPoint(cartesian.clone());
                that.floatPosition = cartesian.clone();
                that.floatPoint.typeAttr = "float";
                that.entity = that.createCircle(that.position, that.radius);
            } else {
                if (that.entity) {
                    that.endCreate();
                    if (callback) callback(that.entity);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) {
            // 移动时绘制线
            if (!that.centerPoint) {
                that.prompt.update(evt.endPosition, "单击开始绘制");

                return;
            }
            that.state = "creating";
            that.prompt.update(evt.endPosition, "再次单击结束");
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer);
            if (!cartesian) return;
            if (that.floatPoint) {
                that.floatPoint.position.setValue(cartesian);
                that.floatPosition = cartesian.clone();
            }
            that.radius = Cesium.Cartesian3.distance(cartesian, that.position);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    /**
     * 通过坐标数组构建
     * @param {Array} lnglatArr 经纬度坐标数组
     * @callback {Function} callback 绘制成功后回调函数
     */
    createByPositions(lnglatArr, callback) {
        if (!lnglatArr || lnglatArr.length < 1) return;
        this.state = "startCreate";
        if (Array.isArray(lnglatArr)) {
            // 第一种 传入中间点坐标和边界上某点坐标
            let isCartesian3 = lnglatArr[0] instanceof Cesium.Cartesian3;
            let positions = [];
            if (isCartesian3) {
                positions = lnglatArr;
            } else {
                positions = util.lnglatsToCartesians(lnglatArr);
            }
            if (!positions || positions.length < 1) return;
            this.position = positions[0].clone();
            this.radius = Cesium.Cartesian3.distance(this.position, positions[1]);
            this.floatPosition = positions[1].clone();
        } else {
            // 第二种 传入中间点坐标和半径
            this.position = lnglatArr.position;
            this.radius = lnglatArr.radius;
            this.floatPosition = util.getPositionByLength();
        }
        this.centerPoint = this.createPoint(this.position);
        this.centerPoint.typeAttr = "center";
        this.floatPoint = this.createPoint(this.float);
        this.floatPoint.typeAttr = "float";
        this.entity = this.createCircle(this.position, this.radius);
        this.state = "endCreate";
        if (callback) callback(this.entity);
    }

    /**
     * 开始编辑
     * @param {Function} callback 回调函数
     */
    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity)
            return;
        this.state = "startEdit";
        if (!this.modifyHandler)
            this.modifyHandler = new Cesium.ScreenSpaceEventHandler(
                this.viewer.scene.canvas
            );
        let that = this;
        if (that.floatPoint) that.floatPoint.show = true;
        if (that.centerPoint) that.centerPoint.show = true;
        this.modifyHandler.setInputAction(function (evt) {
            if (!that.entity) return;
            that.state = "editing";
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                if (!pick.id.objId) that.modifyPoint = pick.id;
                that.forbidDrawWorld(true);
            } else {
                if (that.floatPoint) that.floatPoint.show = false;
                if (that.centerPoint) that.centerPoint.show = false;
                if (that.modifyHandler) {
                    that.modifyHandler.destroy();
                    that.modifyHandler = null;

                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (!that.modifyPoint) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer);
            if (!cartesian) return;
            that.state = "editing";
            if (that.modifyPoint.typeAttr == "center") {
                // 计算当前偏移量
                let subtract = Cesium.Cartesian3.subtract(
                    cartesian,
                    that.position,
                    new Cesium.Cartesian3()
                );
                that.position = cartesian;
                that.centerPoint.position.setValue(that.position);
                that.entity.position.setValue(that.position);

                that.floatPosition = Cesium.Cartesian3.add(
                    that.floatPosition,
                    subtract,
                    new Cesium.Cartesian3()
                );
                that.floatPoint.position.setValue(that.floatPosition);
            } else {
                that.floatPosition = cartesian;
                that.floatPoint.position.setValue(that.floatPosition);
                that.radius = Cesium.Cartesian3.distance(that.floatPosition, that.position);
            }
            if (callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!that.modifyPoint) return;
            that.modifyPoint = null;
            that.forbidDrawWorld(false);
            that.state = "editing";
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    /**
     * 结束绘制cartesiansToLnglats
     * @param {Function} callback 结束绘制后回调函数
     */
    endCreate() {
        let that = this;
        that.state = "endCreate";
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.floatPoint) that.floatPoint.show = false;
        if (that.centerPoint) that.centerPoint.show = false;
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    /**
     * 结束编辑
     * @param {Function} callback 回调函数
     */
    endEdit(callback) {
        if (this.floatPoint) this.floatPoint.show = false;
        if (this.centerPoint) this.centerPoint.show = false;
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }

    createCircle() {
        let that = this;
        let defauteObj = {
            semiMajorAxis: new Cesium.CallbackProperty(function () {
                return that.radius;
            }, false),
            semiMinorAxis: new Cesium.CallbackProperty(function () {
                return that.radius;
            }, false),
            material:
                this.style.color instanceof Cesium.Color
                    ? this.style.color
                    : this.style.color
                    ? Cesium.Color.fromCssColorString(this.style.color).withAlpha(
                        this.style.colorAlpha || 1
                    )
                    : Cesium.Color.WHITE,
            outlineColor:
                this.style.outlineColor instanceof Cesium.Color
                    ? this.style.outlineColor
                    : this.style.outlineColor
                    ? Cesium.Color.fromCssColorString(this.style.outlineColor).withAlpha(
                        this.style.outlineColorAlpha || 1
                    )
                    : Cesium.Color.BLACK,
            outline: this.style.outline,
            heightReference : this.style.heightReference,
            outlineWidth: this.style.outlineWidth,
            fill: this.style.fill,
        };
        /*  if (
      !this.style.heightReference ||
      Number(this.style.heightReference) == 0
    ) {
      defauteObj.height = 100 || this.style.height;
      defauteObj.heightReference = 0;
    } else {
      defauteObj.heightReference = 1;
    } */
        let ellipse = this.viewer.entities.add({
            position: this.position,
            ellipse: defauteObj,
        });
        ellipse.objId = this.objId;
        return ellipse;
    }
    setStyle(style) {
        if (!style) return;
        let color = Cesium.Color.fromCssColorString(style.color || "#ffff00");
        color = color.withAlpha(style.colorAlpha);
        this.entity.ellipse.material = color;
        this.entity.ellipse.outline = style.outline;
        this.entity.ellipse.outlineWidth = style.outlineWidth;

        let outlineColor = Cesium.Color.fromCssColorString(
            style.outlineColor || "#000000"
        );
        outlineColor = outlineColor.withAlpha(style.outlineColorAlpha);
        this.entity.ellipse.outlineColor = outlineColor;

        this.entity.ellipse.heightReference = Number(style.heightReference);
        if (style.heightReference == 0) {
            this.entity.ellipse.height = Number(style.height);
            this.updatePointHeight(style.height);
        }
        this.entity.ellipse.fill = Boolean(style.fill);
        this.style = Object.assign(this.style, style);
    }
    getStyle() {
        let obj = {};
        let ellipse = this.entity.ellipse;
        let color = ellipse.material.color.getValue();
        obj.colorAlpha = color.alpha;
        obj.color = new Cesium.Color(
            color.red,
            color.green,
            color.blue,
            1
        ).toCssHexString();
        if (ellipse.outline) obj.outline = ellipse.outline.getValue();
        obj.outlineWidth = ellipse.outlineWidth._value;
        let outlineColor = ellipse.outlineColor.getValue();
        obj.outlineColorAlpha = outlineColor.alpha;
        obj.outlineColor = new Cesium.Color(
            outlineColor.red,
            outlineColor.green,
            outlineColor.blue,
            1
        ).toCssHexString();
        if (ellipse.height) obj.height = ellipse.height.getValue();
        if (ellipse.fill) obj.fill = ellipse.fill.getValue();
        obj.heightReference = ellipse.heightReference.getValue();
        return obj;
    }

    destroy() {
        if (this.handler) {
            this.handler.destroy();
            this.handler = null;
        }
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
        }
        if (this.entity) {
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
        if (this.floatPoint) {
            this.viewer.entities.remove(this.floatPoint);
            this.floatPoint = null;
        }
        if (this.centerPoint) {
            this.viewer.entities.remove(this.centerPoint);
            this.centerPoint = null;
        }

        this.style = null;
        this.modifyPoint = null;
        if (this.prompt) this.prompt.destroy();
        this.forbidDrawWorld(false);
        this.state = "no";
    }
    // 修改点的高度
    updatePointHeight(h) {
        let centerP = this.centerPoint.position.getValue();
        let floatP = this.floatPoint.position.getValue();
        centerP = util.updatePositionsHeight(
            [centerP],
            Number(this.style.height)
        )[0];
        floatP = util.updatePositionsHeight(
            [floatP],
            Number(this.style.height)
        )[0];

        this.centerPoint.position.setValue(centerP);
        this.floatPoint.position.setValue(floatP);
    }
    getPositions(isWgs84) {
        let positions = [];
        if (isWgs84) {
            positions = util.cartesiansToLnglats([this.position, this.floatPosition],this.viewer);
        } else {
            positions = [this.position, this.floatPosition];
        }
        return positions;
    }

}


/**
 * 小模型（gltf、glb）标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreateGltfModel
 */
class CreateGltfModel extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "gltfModel";
        style = style || {};
        this.viewer = viewer;
        if (!style.uri) {
            console.warn("请输入模型地址！");
            return;
        }

        let defaultStyle = {
            heading: 0,
            pitch: 0,
            roll: 0,
            minimumPixelSize: 24,
            maximumScale: 120
        }
        this.style = Object.assign(defaultStyle, style || {});
        /**
         * @property {String} modelUri 模型地址
         */
        this.modelUri = style.uri;
        this.entity = null;
    }

    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer);
            if (cartesian) {
                that.entity.position = cartesian;
                that.position = cartesian.clone();
            }
            that.endCreate();
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            that.prompt.update(evt.endPosition, "单击新增");
            that.state = "creating";
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, [that.entity]);
            if (!cartesian) return;
            if (!that.entity) {
                that.entity = that.createGltfModel(cartesian.clone());
            } else {
                that.entity.position = cartesian;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }
    createByPositions(lnglatArr, callback) {
        if (!lnglatArr) return;
        this.state = "startCreate";
        if (lnglatArr instanceof Cesium.Cartesian3) {
            this.position = lnglatArr;
        } else {
            this.position = Cesium.Cartesian3.fromDegrees(lnglatArr[0], lnglatArr[1], lnglatArr[2] || 0);
        }
        this.entity = this.createGltfModel(this.position);
        callback(this.entity);
        this.state = "endCreate";
    }
    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing") return; //表示还没绘制完成
        if (!this.modifyHandler) this.modifyHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        let that = this;
        let eidtModel;
        this.state = "startEdit";
        this.modifyHandler.setInputAction(function (evt) {
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                eidtModel = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (!eidtModel) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, [that.entity]);
            if (!cartesian) return;
            if (that.entity) {
                that.entity.position.setValue(cartesian);
                that.position = cartesian.clone();
            }
            that.state = "editing";
            if(callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!eidtModel) return;
            that.forbidDrawWorld(false);
            if (that.modifyHandler) {
                that.modifyHandler.destroy();
                that.modifyHandler = null;
            }
            that.state = "editing";
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    endCreate() {
        let that = this;
        that.state = "endCreate";
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    endEdit(callback) {
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }
    createGltfModel(cartesian) {
        if (!cartesian) return;
        let heading = Cesium.Math.toRadians(this.style.heading);
        let pitch = Cesium.Math.toRadians(this.style.pitch);
        let roll = Cesium.Math.toRadians(this.style.roll);
        let hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        let orientation = Cesium.Transforms.headingPitchRollQuaternion(cartesian, hpr);

        let entity = this.viewer.entities.add({
            position: cartesian,
            orientation: orientation,
            model: {
                uri: this.modelUri,
                minimumPixelSize: this.style.minimumPixelSize,
                maximumScale: this.style.maximumScale,
                scale: this.style.scale || 1,
                heightReference: this.style.heightReference
            }
        });
        entity.objId = this.objId;
        return entity;
    }
    getPositions(isWgs84) {
        return isWgs84 ? util.cartesianToLnglat(this.position, this.viewer) : this.position
    }
    getStyle() {
        let obj = {};
        let model = this.entity.model;
        obj.minimumPixelSize = model.minimumPixelSize.getValue();
        let orientation = this.entity.orientation.getValue();
        let p = this.entity.position.getValue(this.viewer.clock.currentTime);
        let hpr = util.oreatationToHpr(p.clone(), orientation, true) || {};
        obj.heading = (hpr.heading || 0) < 360 ? (hpr.heading + 360) : hpr.heading;
        obj.pitch = hpr.pitch || 0;
        obj.roll = hpr.roll || 0;
        obj.scale = model.scale.getValue();
        obj.uri = model.uri.getValue();

        let heightReference = this.entity.heightReference && this.entity.heightReference.getValue();
        if(heightReference!=undefined) obj.heightReference = Number(heightReference);
        return obj;
    }
    setStyle(style) {
        if (!style) return;
        this.setOrientation(style.heading, style.pitch, style.roll);
        this.entity.model.scale.setValue(style.scale == undefined ? 1 : style.scale);
        if (style.uri) this.entity.model.uri.setValue(style.uri);
        if (style.heightReference != undefined) this.entity.model.heightReference.setValue(Number(style.heightReference));
        this.style = Object.assign(this.style, style);
    }

    /**
     * 设置模型姿态
     * @param {Number} h 偏转角
     * @param {Number} p 仰俯角
     * @param {Number} r 翻滚角
     */
    setOrientation(h, p, r) {
        h = h || 0;
        p = p || 0;
        r = r || 0;
        this.style.heading = h;
        this.style.pitch = p;
        this.style.roll = r;
        var heading = Cesium.Math.toRadians(h || 0);
        var pitch = Cesium.Math.toRadians(p || 0);
        var roll = Cesium.Math.toRadians(r || 0);
        var hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        var position = this.entity.position._value;
        var orientation = Cesium.Transforms.headingPitchRollQuaternion(
            position,
            hpr
        );
        if (this.entity) this.entity.orientation = orientation;
    }

    remove() {
        if (this.entity) {
            this.state = "no";
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
    }

    destroy() {
        if (this.handler) {
            this.handler.destroy();
            this.handler = null;
        }
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
        }
        if (this.entity) {
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
        this.style = null;
        if (this.prompt) {
            this.prompt.destroy();
            this.prompt = null;
        }
    }

}

/**
 * 文字标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreateLabel
 */
class CreateLabel extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "label";
        this.viewer = viewer;
        this.style = style;
        /**
         * @property {Cesium.Cartesian3} 坐标
         */
        this.position = null;
    }


    start(callback) {
        if (!this.prompt && this.promptStyle.show)
            this.prompt = new Prompt(this.viewer, this.promptStyle);
        let that = this;
        this.state = "startCreate";
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) {
            //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer);
            if (!cartesian) return;
            that.entity = that.createLabel(cartesian.clone());
            that.position = cartesian.clone();
            that.endCreate();
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        this.handler.setInputAction(function (evt) {
            //单击开始绘制
            that.prompt.update(evt.endPosition, "单击新增");
            that.state = "creating";
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    endCreate() {
        let that = this;
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
        that.state = "endCreate";
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    createByPositions(lnglatArr, callback) {
        if (!lnglatArr) return;
        this.state = "startCreate";
        let position =
            lnglatArr instanceof Cesium.Cartesian3
                ? lnglatArr
                : Cesium.Cartesian3.fromDegrees(
                lnglatArr[0],
                lnglatArr[1],
                lnglatArr[2]
                );
        this.position = position;
        if (!position) return;
        this.entity = this.createLabel(position, this.style.text);
        if (callback) callback(this.entity);
        this.state = "endCreate";
    }

    // 设置相关样式
    setStyle(style) {
        if (!style) return;
        if (style.fillColor) {
            let fillColor =
                style.fillColor instanceof Cesium.Color
                    ? style.fillColor
                    : Cesium.Color.fromCssColorString(style.fillColor || "#ffff00");
            fillColor = fillColor.withAlpha(style.fillColorAlpha || 1);
            this.entity.label.fillColor = fillColor;
        }

        this.entity.label.outlineWidth = style.outlineWidth;
        if (style.backgroundColor) {
            let backgroundColor =
                style.backgroundColor instanceof Cesium.Color
                    ? style.backgroundColor
                    : Cesium.Color.fromCssColorString(style.backgroundColor || "#000000");
            backgroundColor = backgroundColor.withAlpha(
                style.backgroundColorAlpha || 1
            );
            this.entity.label.backgroundColor = backgroundColor;
        }

        if (style.outlineColor) {
            let outlineColor =
                style.outlineColor instanceof Cesium.Color
                    ? style.outlineColor
                    : Cesium.Color.fromCssColorString(style.outlineColor || "#000000");
            outlineColor = outlineColor.withAlpha(
                style.outlineColorAlpha || 1
            );
            this.entity.label.outlineColor = outlineColor;
        }

        if (style.heightReference != undefined)
            this.entity.label.heightReference = Number(style.heightReference);
        if (style.pixelOffset) this.entity.label.pixelOffset = style.pixelOffset;

        if (style.text) this.entity.label.text = style.text;

        if (style.showBackground != undefined)
            this.entity.label.showBackground = Boolean(style.showBackground);

        if (style.scale) {
            this.entity.label.scale = Number(style.scale);
        }


        this.style = Object.assign(this.style, style);
    }
    // 获取相关样式
    getStyle() {
        let obj = {};
        let label = this.entity.label;

        let fillColor = label.fillColor.getValue();
        obj.fillColorAlpha = fillColor.alpha;
        obj.fillColor = new Cesium.Color(
            fillColor.red,
            fillColor.green,
            fillColor.blue,
            1
        ).toCssHexString();

        if (label.outlineWidth != undefined) obj.outlineWidth = label.outlineWidth._value;
        if (label.showBackground != undefined) obj.showBackground = Boolean(label.showBackground.getValue());
        if (label.backgroundColor) {
            let bkColor = label.backgroundColor.getValue();
            obj.backgroundColorAlpha = bkColor.alpha;
            obj.backgroundColor = new Cesium.Color(bkColor.red, bkColor.green, bkColor.blue, 1).toCssHexString();
        }


        if (label.outlineColor) {
            let outlineColor = label.outlineColor.getValue();
            obj.outlineColorAlpha = outlineColor.alpha;
            obj.outlineColor = new Cesium.Color(outlineColor.red, outlineColor.green, outlineColor.blue, 1).toCssHexString();
        }

        if (label.heightReference != undefined) {
            obj.heightReference = label.heightReference.getValue();
        }

        if (label.pixelOffset) obj.pixelOffset = label.pixelOffset.getValue();

        if (label.scale) obj.scale = label.scale.getValue();

        obj.text = label.text.getValue();


        return obj;
    }
    getPositions(isWgs84) {
        return isWgs84 ? util.cartesianToLnglat(this.position) : this.position;
    }

    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity)
            return;
        this.state = "startEdit";
        if (!this.modifyHandler)
            this.modifyHandler = new Cesium.ScreenSpaceEventHandler(
                this.viewer.scene.canvas
            );
        let that = this;
        let editLabel;
        this.modifyHandler.setInputAction(function (evt) {
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                editLabel = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (!editLabel) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer);
            if (!cartesian) return;
            if (that.entity) {
                that.entity.position.setValue(cartesian);
                that.position = cartesian;
                that.state = "editing";
            }
            if (callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!editLabel) return;
            that.forbidDrawWorld(false);
            if (that.modifyHandler) {
                that.modifyHandler.destroy();
                that.modifyHandler = null;
                that.state = "editing";
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }
    endEdit(callback) {
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }
    createLabel(cartesian) {
        if (!cartesian) return;
        let label = this.viewer.entities.add({
            position: cartesian,
            label: {
                text: this.style.text || "--",
                fillColor: this.style.fillColor
                    ? Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(
                        this.style.fillColorAlpha || 1
                    )
                    : Cesium.Color.WHITE,
                backgroundColor: this.style.backgroundColor
                    ? Cesium.Color.fromCssColorString(
                        this.style.backgroundColor
                    ).withAlpha(this.style.backgroundColorAlpha || 1)
                    : Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL,
                outlineWidth: this.style.outlineWidth || 4,
                scale: this.style.scale || 1,
                pixelOffset: this.style.pixelOffset || Cesium.Cartesian2.ZERO,
                showBackground: this.style.showBackground,
                heightReference: this.style.heightReference || 0,
                disableDepthTestDistance: Number.MAX_VALUE
            },
        });
        label.objId = this.objId;
        return label;
    }

};



/**
 * 点标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreatePoint
 */
class CreatePoint extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "point";
        this.viewer = viewer;
        let defaultStyle = {
            color: Cesium.Color.AQUA,
            pixelSize: 10,
            outlineWidth: 1
        }
        this.style = Object.assign(defaultStyle, style || {});

        /**
         * @property {Cesium.Cartesian3} 坐标
         */
        this.position = null;
    }

    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer);
            if (!cartesian) return;
            that.entity = that.createPoint(cartesian);
            that.position = cartesian;
            if (that.handler) {
                that.handler.destroy();
                that.handler = null;
            }
            if (that.prompt) {
                that.prompt.destroy();
                that.prompt = null;
            }
            that.state = "endCreate";
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            that.prompt.update(evt.endPosition, "单击新增");
            that.state = "creating";
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    endCreate() {
        let that = this;
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
        that.state = "endCreate";
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    createByPositions(lnglatArr, callback) {
        if (!lnglatArr) return;
        this.state = "startCreate";
        let position = (lnglatArr instanceof Cesium.Cartesian3) ? lnglatArr : Cesium.Cartesian3.fromDegrees(lnglatArr[0], lnglatArr[1], lnglatArr[2]);
        this.position = position;
        if (!position) return;
        this.entity = this.createPoint(position);
        if (callback) callback(this.entity);
        this.state = "endCreate";
    }

    // 设置相关样式
    setStyle(style) {
        if (!style) return;
        if (style.color) {
            let color = Cesium.Color.fromCssColorString(style.color || "#ffff00");
            color = color.withAlpha(style.colorAlpha);
            this.entity.point.color = color;
        }
        this.entity.point.outlineWidth = Number(style.outlineWidth);
        if (style.outlineColor) {
            let outlineColor = Cesium.Color.fromCssColorString(style.outlineColor || "#000000");
            outlineColor = outlineColor.withAlpha(style.outlineColorAlpha)
            this.entity.point.outlineColor = outlineColor;
        }
        this.entity.point.heightReference = Number(style.heightReference);
        this.entity.point.pixelSize = Number(style.pixelSize);
        this.style = Object.assign(this.style, style);
    }
    // 获取相关样式
    getStyle() {
        let obj = {};
        let point = this.entity.point;

        let color = point.color.getValue();
        obj.colorAlpha = color.alpha;
        obj.color = new Cesium.Color(color.red, color.green, color.blue, 1).toCssHexString();

        obj.outlineWidth = point.outlineWidth._value;
        let outlineColor = point.outlineColor.getValue();
        obj.outlineColorAlpha = outlineColor.alpha;
        obj.outlineColor = new Cesium.Color(outlineColor.red, outlineColor.green, outlineColor.blue, 1).toCssHexString();

        if (point.heightReference != undefined) obj.heightReference = point.heightReference.getValue();
        obj.pixelSize = Number(point.pixelSize);
        return obj;
    }
    getPositions(isWgs84) {
        return isWgs84 ? util.cartesianToLnglat(this.position) : this.position
    }

    getLnglats(){
        return this.getPositions(true);
    }

    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity) return;
        this.state = "startEdit";
        if (!this.modifyHandler) this.modifyHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        let that = this;
        let editPoint;
        this.modifyHandler.setInputAction(function (evt) {
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                editPoint = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (!editPoint) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer);
            if (!cartesian) return;
            if (that.entity) {
                that.entity.position.setValue(cartesian);
                that.position = cartesian;
                that.state = "editing";
            }
            if(callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!editPoint) return;
            that.forbidDrawWorld(false);
            if (that.modifyHandler) {
                that.modifyHandler.destroy();
                that.modifyHandler = null;
                that.state = "editing";
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }
    endEdit(callback) {
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }
    createPoint(cartesian) {
        if (!cartesian) return;
        let point = this.viewer.entities.add({
            position: cartesian,
            point: {
                color: this.style.color instanceof Cesium.Color ? this.style.color : (this.style.color ? Cesium.Color.fromCssColorString(this.style.color).withAlpha(this.style.colorAlpha || 1) : Cesium.Color.WHITE),
                outlineColor: this.style.outlineColor instanceof Cesium.Color ? this.style.outlineColor : (this.style.outlineColor ? Cesium.Color.fromCssColorString(this.style.outlineColor).withAlpha(this.style.outlineColorAlpha || 1) : Cesium.Color.BLACK),
                outlineWidth: this.style.outlineWidth || 4,
                pixelSize: this.style.pixelSize || 20,
                disableDepthTestDistance: Number.MAX_VALUE
            }
        })
        point.objId = this.objId;
        return point;
    }

}


/**
 * 面标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreatePolygon
 */
class CreatePolygon extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "polygon";
        this.viewer = viewer;
        this.entity = null;
        this.polyline = null;
        let defaultStyle = {
            outlineColor: "#000000",
            outlineWidth: 2
        }
        this.style = Object.assign(defaultStyle, style || {});
        this.outline = null;
    }

    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer, []);
            if (!cartesian) return;

            if (that.movePush) {
                that.positions.pop();
                that.movePush = false;
            }
            that.positions.push(cartesian);
            let point = that.createPoint(cartesian);
            point.wz = that.positions.length - 1;
            that.controlPoints.push(point);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) { //移动时绘制面
            if (that.positions.length < 1) {
                that.prompt.update(evt.endPosition, "单击开始绘制");
                that.state = "startCreate";
                return;
            }
            if (that.prompt) that.prompt.update(evt.endPosition, "双击结束，右键取消上一步");
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, []);
            if (that.positions.length >= 1) {
                that.state = "creating";
                if (!that.movePush) {
                    that.positions.push(cartesian);
                    that.movePush = true;
                } else {
                    that.positions[that.positions.length - 1] = cartesian;
                }
                if (that.positions.length == 2) {
                    if (!Cesium.defined(that.polyline)) {
                        that.polyline = that.createPolyline();
                    }
                }
                if (that.positions.length == 3) {
                    if (!Cesium.defined(that.entity)) {
                        that.entity = that.createPolygon(that.style);
                        if (!that.style.outline && that.polyline) { // 不需要创建轮廓 则后续删除
                            that.polyline.show = false;
                        }
                        that.entity.objId = that.objId;
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.handler.setInputAction(function (evt) {
            if (!that.entity) return;
            that.positions.splice(that.positions.length - 2, 1);
            that.viewer.entities.remove(that.controlPoints.pop());
            if (that.positions.length == 2) {
                if (that.entity) {
                    that.viewer.entities.remove(that.entity);
                    that.entity = null;
                    if (that.polyline) that.polyline.show = true;
                }
            }
            if (that.positions.length == 1) {
                if (that.polyline) {
                    that.viewer.entities.remove(that.polyline);
                    that.polyline = null;
                }
                if (that.prompt) that.prompt.update(evt.endPosition, "单击开始绘制");
                that.positions = [];
                that.movePush = false;
            }

        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

        this.handler.setInputAction(function (evt) { //双击结束绘制
            if (!that.entity) return;
            that.endCreate();
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    endCreate() {
        let that = this;
        that.state = "endCreate";
        that.positions.pop();
        that.viewer.entities.remove(that.controlPoints.pop());
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        that.movePush = false;
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }

        that.viewer.trackedEntity = undefined;
        that.viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            if (this.positions.length <= 2 && this.movePush == true) {
                this.destroy();
            } else {
                this.endCreate();
            }
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    createByPositions(lnglatArr, callback) { //通过传入坐标数组创建面
        if (!lnglatArr) return;
        this.state = "startCreate";
        let positions = (lnglatArr[0] instanceof Cesium.Cartesian3) ? lnglatArr : util.lnglatsToCartesians(lnglatArr);
        if (!positions) return;
        this.entity = this.createPolygon();
        this.polyline = this.createPolyline();
        this.polyline.show = this.style.outline;

        this.positions = positions;
        for (let i = 0; i < positions.length; i++) {
            let newP = positions[i];
            let ctgc = Cesium.Cartographic.fromCartesian(positions[i]);
            let point = this.createPoint(newP);
            point.point.heightReference = this.style.heightReference;
            point.ctgc = ctgc;
            point.wz = this.controlPoints.length;
            this.controlPoints.push(point);
        }
        this.state = "endCreate";
        this.entity.objId = this.objId;

        if (callback) callback(this.entity);
    }
    getStyle() {
        if (!this.entity) return;
        let obj = {};
        let polygon = this.entity.polygon;

        if (polygon.material instanceof Cesium.ColorMaterialProperty) {
            obj.material = "common";
            let color = polygon.material.color.getValue();
            obj.colorAlpha = color.alpha;
            obj.color = new Cesium.Color(color.red, color.green, color.blue, 1).toCssHexString();
        } else {

        }

        obj.fill = polygon.fill ? polygon.fill.getValue() : false;
        if (polygon.heightReference) {
            let heightReference = polygon.heightReference.getValue();
            obj.heightReference = Number(heightReference);
        }

        /* obj.heightReference = isNaN(polygon.heightReference.getValue()) ? false : polygon.heightReference.getValue(); */
        let outline = this.polyline.polyline;
        if (outline && this.polyline.show) {
            obj.outlineWidth = outline.width.getValue();
            /* obj.outline = "show"; */
            obj.outline = true;
            let oColor = outline.material.color.getValue();
            obj.outlineColorAlpha = oColor.alpha;
            obj.outlineColor = new Cesium.Color(oColor.red, oColor.green, oColor.blue, 1).toCssHexString();
        } else {
            /* obj.outline = "hide"; */
            obj.outline = false;
        }
        return obj;

    }
    // 设置相关样式
    setStyle(style) {
        if (!style) return;
        // 由于官方api中的outline限制太多 此处outline为重新构建的polyline
        /* this.polyline.show = style.outline.show == "show" ? true : false; */
        this.polyline.show = style.outline;
        let outline = this.polyline.polyline;
        outline.width = style.outlineWidth;
        this.polyline.clampToGround = Boolean(style.heightReference);
        let outlineColor = (style.outlineColor instanceof Cesium.Color) ? style.outlineColor : Cesium.Color.fromCssColorString(style.outlineColor);
        let outlineMaterial = outlineColor.withAlpha(style.outlineColorAlpha || 1);
        outline.material = outlineMaterial;
        if (style.heightReference != undefined) this.entity.polygon.heightReference = Number(style.heightReference);
        let color = style.color instanceof Cesium.Color ? style.color : Cesium.Color.fromCssColorString(style.color);
        let material = color.withAlpha(style.colorAlpha || 1);
        this.entity.polygon.material = material;
        if (style.fill != undefined) this.entity.polygon.fill = style.fill;
        this.style = Object.assign(this.style, style);
    }

    createPolygon() {
        let that = this;
        this.style.color = this.style.color || Cesium.Color.WHITE;
        this.style.outlineColor = this.style.outlineColor || Cesium.Color.BLACK;
        let polygonObj = {
            polygon: {
                hierarchy: new Cesium.CallbackProperty(function () {
                    return new Cesium.PolygonHierarchy(that.positions)
                }, false),
                heightReference: Number(this.style.heightReference),
                show: true,
                fill: this.style.fill == undefined ? true : this.style.fill,
                material: this.style.color instanceof Cesium.Color ? this.style.color : Cesium.Color.fromCssColorString(this.style.color).withAlpha(this.style.colorAlpha || 1)
            }
        }

        if (!this.style.heightReference) {
            polygonObj.polygon.height = 0; // 不贴地 必设
            polygonObj.polygon.perPositionHeight = true; // 启用点的真实高度
        }
        return this.viewer.entities.add(polygonObj);
    }
    createPolyline() {
        let that = this;
        return this.viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(function () {
                    let newPositions = that.positions.concat(that.positions[0]);
                    return newPositions
                }, false),
                clampToGround: Boolean(this.style.heightReference),
                material: this.style.outlineColor instanceof Cesium.Color ? this.style.outlineColor : Cesium.Color.fromCssColorString(this.style.outlineColor).withAlpha(this.style.outlineColorAlpha || 1),
                width: this.style.outlineWidth || 1
            }
        });
    }

    destroy() {
        if (this.handler) {
            this.handler.destroy();
            this.handler = null;
        }
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
        }
        if (this.entity) {
            this.viewer.entities.remove(this.entity);
            this.entity = null;
        }
        if (this.polyline) {
            this.viewer.entities.remove(this.polyline);
            this.polyline = null;
        }
        this.positions = [];
        this.style = null;
        if (this.modifyPoint) {
            this.viewer.entities.remove(this.modifyPoint);
            this.modifyPoint = null;
        }
        for (let i = 0; i < this.controlPoints.length; i++) {
            let point = this.controlPoints[i];
            this.viewer.entities.remove(point);
        }
        this.controlPoints = [];
        this.state = "no";
        if (this.prompt) this.prompt.destroy();
        if (this.polyline) {
            this.polyline = null;
            this.viewer.entities.remove(this.polyline);
        }
        this.forbidDrawWorld(false);
    }

}


/**
 * 矩形标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.BasePlot
 */
class CreateRectangle extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        this.type = "rectangle";
        this.viewer = viewer;
        this.style = style;

        /**
         * @property {Cesium.Entity} rightdownPoint 右下角实体点
         */
        this.rightdownPoint = null;

        /**
         * @property {Cesium.Entity} leftupPoint 左上角实体点
         */
        this.leftupPoint = null;

        /**
         * @property {Cesium.Cartesian3} leftup 左上角点坐标
         */
        this.leftup = null;

        /**
         * @property {Cesium.Cartesian3} rightdown 右下角点坐标
         */
        this.rightdown = null;

        this.modifyPoint = null;
        this.pointArr = [];
    }
    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer, []);
            if (!cartesian) return;
            if (!that.leftupPoint) {
                that.leftup = cartesian;
                that.leftupPoint = that.createPoint(cartesian);
                that.leftupPoint.typeAttr = "leftup";
                that.rightdownPoint = that.createPoint(cartesian.clone());
                that.rightdown = cartesian.clone();
                that.rightdownPoint.typeAttr = "rightdown";
                that.entity = that.createRectangle();
            } else {
                if (!that.entity) {
                    return;
                }
                that.endCreate();
                if (callback) callback(that.entity);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function (evt) { //移动时绘制线
            if (!that.leftupPoint) {
                that.prompt.update(evt.endPosition, "单击开始绘制");
                that.state = "startCreate";
                return;
            }
            that.prompt.update(evt.endPosition, "单击结束");
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, []);
            if (!cartesian) return;
            if (that.rightdownPoint) {
                that.rightdownPoint.position.setValue(cartesian);
                that.rightdown = cartesian.clone();
                that.state = "creating";
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    endCreate() {
        let that = this;
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        if (that.rightdownPoint) that.rightdownPoint.show = false;
        if (that.leftupPoint) that.leftupPoint.show = false;
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
        that.state = "endCreate";
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            this.destroy();
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    startEdit(callback) {
        if (this.state == "startEdit" || this.state == "editing" || !this.entity) return;
        this.state = "startEdit";
        if (!this.modifyHandler) this.modifyHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        let that = this;
        if (that.rightdownPoint) that.rightdownPoint.show = true;
        if (that.leftupPoint) that.leftupPoint.show = true;
        this.modifyHandler.setInputAction(function (evt) {
            if (!that.entity) return;
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) {
                if (!pick.id.objId)
                    that.modifyPoint = pick.id;
                that.forbidDrawWorld(true);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.modifyHandler.setInputAction(function (evt) {
            if (!that.modifyPoint) return;
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, [that.entity, that.modifyPoint]);
            if (!cartesian) {
                return;
            }
            that.state == "editing";
            if (that.modifyPoint.typeAttr == "leftup") {
                that.leftup = cartesian
                that.leftupPoint.position.setValue(that.leftup);
                that.entity.position.setValue(that.leftup);
            } else {
                that.rightdown = cartesian
                that.rightdownPoint.position.setValue(that.rightdown);
            }
            if(callback) callback();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.modifyHandler.setInputAction(function (evt) {
            if (!that.modifyPoint) return;
            that.modifyPoint = null;
            that.forbidDrawWorld(false);
            that.state == "editing";
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }
    endEdit(callback) {
        if (this.rightdownPoint) this.rightdownPoint.show = false;
        if (this.leftupPoint) this.leftupPoint.show = false;
        if (this.modifyHandler) {
            this.modifyHandler.destroy();
            this.modifyHandler = null;
            if (callback) callback(this.entity);
        }
        this.forbidDrawWorld(false);
        this.state = "endEdit";
    }

    createRectangle() {
        let that = this;
        let rectangle = this.viewer.entities.add({
            rectangle: {
                coordinates: new Cesium.CallbackProperty(function () {
                    return Cesium.Rectangle.fromCartesianArray([that.leftup, that.rightdown])
                }, false),
                heightReference: this.style.heightReference || 0,
                show: true,
                fill: this.style.fill || true,
                material: this.style.color instanceof Cesium.Color ? this.style.color : (this.style.color ? Cesium.Color.fromCssColorString(this.style.color).withAlpha(this.style.colorAlpha || 1) : Cesium.Color.WHITE),
                outlineColor: this.style.outlineColor instanceof Cesium.Color ? this.style.outlineColor : (this.style.outlineColor ? Cesium.Color.fromCssColorString(this.style.outlineColor).withAlpha(this.style.outlineColorAlpha || 1) : Cesium.Color.BLACK),
                outlineWidth: 1,
                outline: this.style.outline,
            }
        });
        rectangle.objId = this.objId;
        return rectangle;
    }
    getPositions(isWgs84) {
        let positions = [];
        if (isWgs84) {
            positions = util.cartesiansToLnglats([this.leftup, this.rightdown],this.viewer);
        } else {
            positions = [this.leftup, this.rightdown];
        }
        return positions;
    }
    getStyle() {
        let obj = {};
        let rectangle = this.entity.rectangle;
        let color = rectangle.material.color.getValue();
        obj.colorAlpha = color.alpha;
        obj.color = new Cesium.Color(color.red, color.green, color.blue, 1).toCssHexString();
        if (rectangle.outline) obj.outline = rectangle.outline.getValue();
        obj.outlineWidth = rectangle.outlineWidth._value;
        let outlineColor = rectangle.outlineColor.getValue();
        obj.outlineColorAlpha = outlineColor.alpha;
        obj.outlineColor = new Cesium.Color(outlineColor.red, outlineColor.green, outlineColor.blue, 1).toCssHexString();
        if (obj.height) obj.height = rectangle.height.getValue();
        if (rectangle.fill) obj.fill = rectangle.fill.getValue();
        obj.heightReference = rectangle.heightReference.getValue();
        return obj;
    }
    setStyle(style) {
        if (!style) return;
        let color = style.color instanceof Cesium.Color ? style.color : Cesium.Color.fromCssColorString(style.color || "#ffff00");
        if (style.colorAlpha) color = color.withAlpha(style.colorAlpha);
        this.entity.rectangle.material = color;
        this.entity.rectangle.outline = style.outline;
        this.entity.rectangle.outlineWidth = style.outlineWidth;

        let outlineColor = style.outlineColor instanceof Cesium.Color ? style.outlineColor : Cesium.Color.fromCssColorString(style.outlineColor || "#000000");
        if (style.outlineColorAlpha) outlineColor = outlineColor.withAlpha(style.outlineColorAlpha)
        this.entity.rectangle.outlineColor = outlineColor;

        this.entity.rectangle.heightReference = Number(style.heightReference);
        if (style.heightReference == 0) {
            this.entity.rectangle.height = Number(style.height);
            this.updatePointHeight(style.height);
        }
        this.entity.rectangle.fill = Boolean(style.fill);
        this.style = Object.assign(this.style, style);
    }
}


/**
 * 线标绘类
 * @class
 * @augments BasePlot
 * @alias BasePlot.CreatePolyline
 */
class CreatePolyline extends BasePlot {
    constructor(viewer, style) {
        super(viewer, style);
        style = style || {};
        this.movePush = false;
        this.type = "polyline";
        /**
         * @property {Number} [maxPointNum=Number.MAX_VALUE] 线的最大点位数量
         */
        this.maxPointNum = style.maxPointNum || Number.MAX_VALUE; // 最多点数
    }

    /**
     * 开始绘制
     * @param {Function} callback 绘制完成之后的回调函数
     */
    start(callback) {
        if (!this.prompt && this.promptStyle.show) this.prompt = new Prompt(this.viewer, this.promptStyle);
        this.state = "startCreate";
        let that = this;
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) { //单击开始绘制
            let cartesian = that.getCatesian3FromPX(evt.position, that.viewer, [that.entity]);
            if (!cartesian) return;
            if (that.movePush) {
                that.positions.pop();
                that.movePush = false;
            }
            that.positions.push(cartesian);
            let point = that.createPoint(cartesian);
            point.wz = that.positions.length - 1;
            that.controlPoints.push(point);

            // 达到最大数量 结束绘制
            if (that.positions.length == that.maxPointNum) {
                that.endCreate();
                if (callback) callback(that.entity);
            }

        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        this.handler.setInputAction(function (evt) { //移动时绘制线
            that.state = "creating";
            if (that.positions.length < 1) {
                that.prompt.update(evt.endPosition, "单击开始绘制");
                that.state = "startCreate";
                return;
            }
            that.prompt.update(evt.endPosition, "右键取消上一步，双击结束");
            let cartesian = that.getCatesian3FromPX(evt.endPosition, that.viewer, [that.entity]);
            if (!cartesian) return;

            if (!that.movePush) {
                that.positions.push(cartesian);
                that.movePush = true;
            } else {
                that.positions[that.positions.length - 1] = cartesian;
            }

            if (that.positions.length == 2) {
                if (!Cesium.defined(that.entity)) {
                    that.entity = that.createPolyline();
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this.handler.setInputAction(function (evt) { //右键取消上一步
            if (!that.entity) {
                return;
            }
            that.positions.splice(that.positions.length - 2, 1);
            that.viewer.entities.remove(that.controlPoints.pop())
            if (that.positions.length == 1) {
                if (that.entity) {
                    that.viewer.entities.remove(that.entity);
                    that.entity = null;
                }
                that.prompt.update(evt.endPosition, "单击开始绘制");
                that.movePush = false;
                that.positions = [];
            }
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

        this.handler.setInputAction(function (evt) { //双击结束绘制
            if (!that.entity) {
                return;
            }
            that.endCreate();
            if (callback) callback(that.entity);
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    endCreate() {
        let that = this;
        that.state = "endCreate";
        if (that.handler) {
            that.handler.destroy();
            that.handler = null;
        }
        that.positions.pop();
        that.viewer.entities.remove(that.controlPoints.pop())
        if (that.prompt) {
            that.prompt.destroy();
            that.prompt = null;
        }
        that.viewer.trackedEntity = undefined;
        that.viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }

    /**
     * 当前步骤结束
     */
    done() {
        if (this.state == "startCreate") {
            this.destroy();
        } else if (this.state == "creating") {
            if (this.positions.length <= 2 && this.movePush == true) {
                this.destroy();
            } else {
                this.endCreate();
            }
        } else if (this.state == "startEdit" || this.state == "editing") {
            this.endEdit();
        } else {

        }
    }

    createByPositions(lnglatArr, callback) { //通过传入坐标数组创建面
        if (!lnglatArr || lnglatArr.length < 1) return;
        this.state = "startCreate";
        let positions = (lnglatArr[0] instanceof Cesium.Cartesian3) ? lnglatArr : util.lnglatsToCartesians(lnglatArr);
        if (!positions) return;
        this.entity = this.createPolyline(this.style);
        this.positions = positions;
        if (callback) callback(this.entity);
        for (let i = 0; i < positions.length; i++) {
            let newP = positions[i];

            let point = this.createPoint(newP);
            if (this.style.clampToGround) {
                point.point.heightReference = 1;
            }
            point.wz = this.controlPoints.length;
            this.controlPoints.push(point);
        }
        this.state = "endCreate";
    }

    setStyle(style) {
        if (!style) return;

        let material = this.getMaterial(style.material, style);
        this.entity.polyline.material = material;
        this.entity.polyline.clampToGround = Boolean(style.clampToGround);
        if (style.width) this.entity.polyline.width = style.width || 3;
        this.style = Object.assign(this.style, style);
    }
    // 获取相关样式
    getStyle() {
        if (!this.entity) return;
        let obj = {};
        let polyline = this.entity.polyline;
        if (this.style.animateType != undefined) {
            obj.animateType = this.style.animateType;
            obj.image = this.style.image;
            obj.duration = this.style.duration;
        }
        if (polyline.material instanceof Cesium.ColorMaterialProperty) {
            obj.material = "common";
        } else {
            obj.material = "flowline";
            if (polyline.material instanceof animate.FlowLineMaterial) {
            }
            obj.duration = polyline.material._duration;
            obj.image = polyline.material.url;
        }

        let color = polyline.material.color.getValue();
        obj.colorAlpha = color.alpha;
        obj.color = new Cesium.Color(color.red, color.green, color.blue, 1).toCssHexString();
        obj.width = polyline.width._value;
        let clampToGround = polyline.clampToGround ? polyline.clampToGround.getValue() : false;
        obj.clampToGround = Boolean(clampToGround);
        return obj;
    }

    createPolyline() {
        let that = this;

        let polyline = this.viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(function () {
                    return that.positions
                }, false),
                show: true,
                material: this.getMaterial(this.style.animateType, this.style),
                width: this.style.width || 3,
                clampToGround: this.style.clampToGround
            }
        });
        polyline.objId = this.objId; // 此处进行和entityObj进行关联
        return polyline;
    }

    getMaterial(animateType, style) {
        // 构建多种材质的线
        style = style || {};
        let material = null;
        let color = style.color || Cesium.Color.WHITE;
        color = color instanceof Cesium.Color ? color : Cesium.Color.fromCssColorString(style.color);
        color = color.withAlpha(style.colorAlpha || 1);
        if (animateType == "flowline") {
            /* if (!style.image) {
              console.log("动态材质，缺少纹理图片");
              return color;
          }
          material = new animate.FlowLine({
              color: color, // 默认颜色
              image: style.image,
              duration: style.duration || 5000
          }) */
        } else if (animateType == "flyline") {
            /* if (!style.image) {
              console.log("动态材质，缺少纹理图片");
              return color;
          }
          material = new animate.FlyLine({ //动画线材质
              color: color,
              duration: style.duration || 3000,
              image: style.image,
              repeat: new Cesium.Cartesian2(1, 1) //平铺
          }) */
        } else {
            material = color;
        }
        return material;
    }

}



/**
 * 绘制控制类
 *
 * @class
 * @example
 * let drawTool = new easy3d.DrawTool(window.viewer, {
    canEdit: true,
  });
 plotDrawTool.on("endCreate", function (entObj, ent) {});
 plotDrawTool.start({
      "name": "面",
      "type": "polygon",
      "style": {
          "color": "#0000ff",
          "outline": true,
          "outlineColor": "#ff0000",
          "heightReference": 1
      }
  })
 */
class DrawTool {
    /**
     *
     * @param {Cesium.viewer} viewer 地图viewer对象
     * @param {Object} obj 相关属性配置
     * @param {Boolean} obj.canEdit 是否可编辑
     */
    constructor(viewer, obj) {
        if (!viewer) {
            console.warn("缺少必要参数！--viewer");
            return;
        }
        obj = obj || {};
        this.viewer = viewer;
        /**
         *
         * @property {Array} entityObjArr 标绘对象数组
         */
        this.entityObjArr = [];
        this.handler = null;
        this.removeHandler = new Cesium.ScreenSpaceEventHandler(
            this.viewer.scene.canvas
        );
        /* this.show = obj.drawEndShow == undefined ? true : obj.drawEndShow; */

        /**
         * @property {Object} nowEditEntityObj 当前编辑对象
         */
        this.startEditFun = null;
        this.endEditFun = null;
        this.removeFun = null;
        this.editingFun = undefined;

        this.deleteEntityObj = null;

        // 无论如何 进来先监听点击修改 与 右键删除事件 通过控制canEdit来判断要不要向下执行
        this.bindEdit();
        // this.bindRemove();

        /**
         * @property {Boolear} canEdit 绘制的对象，是否可编辑
         */
        this.canEdit = obj.canEdit == undefined ? true : obj.canEdit;; // 是否可以编辑

        /**
         * @property {Boolear} fireEdit 绘制的对象，是否直接进入编辑状态（需要canEdit==true）
         */
        this.fireEdit = obj.fireEdit == undefined ? true : obj.fireEdit;;

        this.nowDrawEntityObj = null; // 当前绘制的对象
        this.nowEditEntityObj = null; // 当前编辑的对象
    }

    /**
     * 事件绑定
     * @param {String} type 事件类型（startEdit 开始编辑时 / endEdit 编辑结束时 / remove 删除对象时 / endCreate 创建完成后）
     * @param {Function} fun 绑定函数
     */
    on(type, fun) {
        if (type == "startEdit") {
            // 开始编辑事件
            this.startEditFun = fun;
        }
        if (type == "endEdit") {
            // 结束编辑事件
            this.endEditFun = fun;
        }
        if (type == "remove") {
            // 移除事件
            this.removeFun = fun;
        }
        if (type == "endCreate") {
            // 绘制完成事件
            this.endCreateFun = fun;
        }
        if (type == "editing") {
            // 正在编辑
            this.editingFun = fun;
        }
    }

    /**
     * 开启编辑功能
     */
    openEdit() {
        this.canEdit = true;
    }

    /**
     * 关闭编辑功能
     */
    closeEdit() {
        this.endEdit();
        this.canEdit = false;
    }

    /**
     * 开始绘制
     * @param {Object} opt 相关属性
     * @param {String} opt.type 绘制类型 polyline、polygon、billboard、circle、rectangle、gltfModel、point、label、arrow
     * @param {Object} opt.style 当前绘制对象的样式配置，具体配置见{@link style};
     * @returns {Object} entityObj 当前绘制对象
     */
    start(opt) {
        if (!opt || !opt.type) {
            return;
        }
        opt.id = opt.id || Number((new Date()).getTime() + "" + Number(Math.random() * 1000).toFixed(0));
        let that = this;
        this.endEdit(); // 绘制前  结束编辑

        if (this.nowDrawEntityObj && (
            this.nowDrawEntityObj.state == "startCreate" ||
            this.nowDrawEntityObj.state == "creating")) { // 禁止一次绘制多个
            this.nowDrawEntityObj.destroy();
            this.nowDrawEntityObj = null;
        }
        let entityObj = this.createByType(opt);
        if (!entityObj) return;
        entityObj.attr = opt || {}; // 保存开始绘制时的属性

        // 开始绘制
        entityObj.start(function (entity) {
            // 绘制完成后
            that.nowDrawEntityObj = undefined;
            that.entityObjArr.push(entityObj);
            // endCreateFun 和 success 无本质区别，若构建时 两个都设置了 当心重复
            if (opt.success) opt.success(entityObj, entity);
            if (that.endCreateFun) that.endCreateFun(entityObj, entity);

            if (opt.show == false) entityObj.setVisible(false);

            // 如果可以编辑 则绘制完成打开编辑
            if (that.canEdit && that.fireEdit) {
                entityObj.startEdit(function () {
                    if (that.editingFun) that.editingFun(entityObj, entityObj.entity);
                });
                that.nowEditEntityObj = entityObj;
                if (that.startEditFun) that.startEditFun(entityObj, entity);
            }
        });

        this.nowDrawEntityObj = entityObj;
        return entityObj;
    }

    /**
     * 结束当前操作
     */
    end() {
        if (this.nowDrawEntityObj) {

        }
    }

    /**
     * 开始编辑绘制对象
     * @param {Object} entityObj 绘制的对象
     */
    startEditOne(entityObj) {
        if (!this.canEdit) return;
        if (this.nowEditEntityObj) {
            // 结束除当前选中实体的所有编辑操作
            this.nowEditEntityObj.endEdit();
            if (this.endEditFun) {
                this.endEditFun(this.nowEditEntityObj, this.nowEditEntityObj.getEntity()); // 结束事件
            }
            this.nowEditEntityObj = null;
        }
        let that = this;
        if (entityObj) {
            entityObj.startEdit(function () {
                if (that.editingFun) that.editingFun(entityObj, entityObj.entity);
            });
            if (this.startEditFun)
                this.startEditFun(entityObj, entityObj.getEntity());
            this.nowEditEntityObj = entityObj;
        }
    }

    /**
     * 修改绘制对象的样式
     * @param {Object} entityObj 绘制的对象
     * @param {Object} style 样式
     */
    updateOneStyle(entityObj, style) {
        if (entityObj) {
            entityObj.setStyle(style);
        }
    }

    /**
     * 根据坐标构建绘制对象
     * @param {Object} opt 绘制的对象
     * @param {Cesium.Cartesian3[] | Array} opt.positions 坐标数组
     * @param {Object} opt.style 当前绘制对象的样式配置，具体配置见{@link style};
     * @param {Funtion} opt.success 创建完成的回调函数
     * @param {Boolean} [opt.show] 创建完成后，是否展示
     */
    createByPositions(opt) {
        opt = opt || {};
        if (!opt) opt = {};
        if (!opt.positions) return;
        opt.id = opt.id || Number((new Date()).getTime() + "" + Number(Math.random() * 1000).toFixed(0));
        let that = this;
        let entityObj = this.createByType(opt);
        if (!entityObj) return;
        entityObj.attr = opt; // 保存开始绘制时的属性
        entityObj.createByPositions(opt.positions, function (entity) {
            that.entityObjArr.push(entityObj);
            entityObj.setStyle(opt.style); // 设置相关样式
            // endCreateFun 和 success 无本质区别，若构建时 两个都设置了 当心重复
            if (opt.success) opt.success(entityObj, entity);
            if (that.endCreateFun) that.endCreateFun(entityObj, entity);
            if (opt.show == false) entityObj.setVisible(false);
            // 如果可以编辑 则绘制完成打开编辑
            if (that.canEdit && that.fireEdit) {
                entityObj.startEdit(function () {
                    if (that.editingFun) that.editingFun(entityObj, entityObj.entity);
                });
                if (that.startEditFun) that.startEditFun(entityObj, entity);
                that.nowEditEntityObj = entityObj;
            }
        });
        return entityObj;
    }

    /**
     * 由geojson格式数据创建对象
     * @param {Object} data geojson格式数据
     */
    createByGeojson(data) {
        let { features } = data;
        let entObjArr = [];
        for (let i = 0; i < features.length; i++) {
            let feature = features[i];
            const { properties, geometry } = feature;
            let plotType = properties.plotType;
            const geoType = geometry.type;
            const coordinates = geometry.coordinates;
            let positions = [];
            let drawType = "";
            switch (geoType) {
                case "LineString":
                    positions = util.lnglatsToCartesians(coordinates);
                    drawType = "polyline";
                    break;
                case "Polygon":
                    positions = util.lnglatsToCartesians(coordinates[0]);
                    drawType = "polygon";
                    break;
                case "Point":
                    positions = util.lnglatsToCartesians([coordinates])[0];
                    drawType = plotType;
                    break;
                default: ;
            }
            this.fireEdit = false;
            let entObj = this.createByPositions({
                type: drawType,
                styleType: plotType,
                positions: positions,
                style: properties.style
            })
            if (entObj) entObjArr.push(entObj);
        }
        return entObjArr;
    }

    /**
     * 转为geojson格式
     * @returns {Object} featureCollection geojson格式数据
     */
    toGeojson() {
        let featureCollection = {
            type: "FeatureCollection",
            features: [],
        };
        if (this.entityObjArr.length == 0) return null;
        for (let i = 0; i < this.entityObjArr.length; i++) {
            let item = this.entityObjArr[i];
            let lnglats = item.getPositions(true);
            // geojson中 单个坐标 不含高度 否则geojsondatasourece加载会有问题
            let coordinates = [];
            for (let step = 0; step < lnglats.length; step++) {
                coordinates.push([lnglats[step][0], lnglats[step][1]])
            }
            let style = item.getStyle();
            let geoType = this.transType(item.type);
            let feature = {
                "type": "Feature",
                "properties": {
                    "plotType": item.type,
                    "style": style,
                },
                "geometry": {
                    "type": geoType,
                    "coordinates": []
                }
            }
            switch (geoType) {
                case "Polygon":
                    feature.geometry.coordinates = [coordinates];
                    break;
                case "Point":
                    feature.geometry.coordinates = coordinates;
                    break;
                case "LineString":
                    feature.geometry.coordinates = coordinates;
                    break;
                case "":

                default: ;
            }
            feature.properties = Object.assign(feature.properties, item.properties);
            featureCollection.features.push(feature);
        }
        return featureCollection;
    }

    // 标绘类型和geojson数据类型相互转换
    transType(plotType) {
        let geoType = '';
        switch (plotType) {
            case "polyline":
                geoType = "LineString";
                break;
            case "polygon":
                geoType = "Polygon";
                break;
            case "point":
            case "gltfModel":
            case "label":
            case "billboard":
                geoType = "Point";
                break;
            default:
                geoType = plotType;
        }
        return geoType;
    }

    /**
     * 销毁
     */
    destroy() {
        // 取消当前绘制
        if (this.nowEditEntityObj) {
            this.nowEditEntityObj.destroy();
            this.nowEditEntityObj = null;
        }
        if (this.nowDrawEntityObj) {
            this.nowDrawEntityObj.destroy();
            this.nowDrawEntityObj = null;
        }

        for (let i = 0; i < this.entityObjArr.length; i++) {
            this.entityObjArr[i].destroy();
        }
        this.entityObjArr = [];
        this.nowEditEntityObj = null;

        if (this.handler) {
            this.handler.destroy();
            this.handler = null;
        }

        if (this.removeHandler) {
            this.removeHandler.destroy();
            this.removeHandler = null;
        }
    }

    /**
     * 移除某个绘制对象
     * @param {Object} entityObj 已绘制完成绘制对象
     */
    removeOne(entityObj) {
        if (!entityObj) return;
        if (!entityObj) return;
        if (entityObj.state != "endCreate" || entityObj.state != "endEdit") {
            entityObj.destroy();
        } else {
            this.removeByObjId(entityObj.objId);
        }

    }

    /**
     * 移除全部绘制对象
     */
    removeAll() {
        // 取消当前绘制
        if (this.nowDrawEntityObj) {
            this.nowDrawEntityObj.destroy();
            this.nowDrawEntityObj = null;
        }

        if (this.nowEditEntityObj) {
            this.nowEditEntityObj.destroy();
            this.nowEditEntityObj = null;
        }

        for (let i = 0; i < this.entityObjArr.length; i++) {
            let obj = this.entityObjArr[i];
            obj.destroy();
        }
        this.entityObjArr = [];
        this.nowEditEntityObj = null;
    }

    /**
     * 是否包含某个对象
     * @param {Object} entityObj 绘制对象
     */
    hasEntityObj(entityObj) {
        if (!entityObj) return false;
        let obj = this.getEntityObjByObjId(entityObj.objId);
        return obj != {} ? true : false;
    }

    /**
     * 根据id移除创建的对象
     * @param {String | Number} id 对象id
     */
    removeByObjId(id) {
        let obj = this.getEntityObjByObjId(id);
        this.entityObjArr.splice(obj.index, 1);
        // 触发on绑定的移除事件
        if (this.removeFun)
            this.removeFun(obj.entityObj, obj.entityObj.getEntity());
        if (obj.entityObj) {
            obj.entityObj.destroy();
        }
    }

    /**
     * 根据attr.id移除创建的对象
     * @param {String | Number} id 创建时的attr.id
     */
    removeById(id) {
        let obj = this.getEntityObjById(id);
        this.entityObjArr.splice(obj.index, 1);
        // 触发on绑定的移除事件
        if (this.removeFun)
            this.removeFun(obj.entityObj, obj.entityObj.getEntity());
        if (obj.entityObj) {
            obj.entityObj.destroy();
        }
    }


    /**
     * 根据id缩放至绘制的对象
     * @param {String} id 对象id
     */
    zoomToByObjId(id) {
        let obj = this.getEntityObjByObjId(id);
        if (obj.entityObj) {
            obj.entityObj.zoomTo();
        }
    }


    /**
     * 根据attr属性字段获取对象
     * @param {String} fieldName 属性字段名称
     * @param {String} [fieldValue] 属性值，若不填，则默认以id进行查询
     * @returns {Object} obj 对象在数组中位置以及对象
     */

    getEntityObjByField(fieldName, fieldValue) {
        let obj = {};
        if (!fieldValue) {
            // 如果缺少第二个参数 则默认以attr.id进行查询
            for (let i = 0; i < this.entityObjArr.length; i++) {
                let item = this.entityObjArr[i];
                if (item.attr.id == fieldName) {
                    obj.entityObj = item;
                    obj.index = i;
                    break;
                }
            }
        } else {
            // 否则 以键值对的形式进行查询
            for (let ind = 0; ind < this.entityObjArr.length; ind++) {
                let item = this.entityObjArr[ind];
                if (item.attr[fieldName] == fieldValue) {
                    obj.entityObj = item;
                    obj.index = ind;
                    break;
                }
            }
        }
        return obj;
    }

    /**
     * 根据id设置对象的显示隐藏
     * @param {String | Number} id 对象id
     * @param {Boolean} visible 是否展示
     */
    setVisible(id, visible) {
        let obj = this.getEntityObjByField("id", id);
        if (obj.entityObj) obj.entityObj.setVisible(visible);
    }

    /**
     * 根据id获取对象
     * @param {String | Number} id entityObj的objid
     * @returns {Object} obj 对象在数组中位置以及对象
     */
    getEntityObjByObjId(id) {
        if (!id) return;
        let obj = {};
        for (let i = 0; i < this.entityObjArr.length; i++) {
            let item = this.entityObjArr[i];
            if (item.objId == id) {
                obj.entityObj = item;
                obj.index = i;
                break;
            }
        }
        return obj;
    }

    /**
     * 根据id获取对象，同getEntityObjByField('id',idvalue);
     * @param {String | Number} id 创建时的attr中的id
     * @returns {Object} obj 对象在数组中位置以及对象
     */
    getEntityObjById(id) {
        if (!id) return;
        let obj = {};
        for (let i = 0; i < this.entityObjArr.length; i++) {
            let item = this.entityObjArr[i];
            if (item.attr.id == id) {
                obj.entityObj = item;
                obj.index = i;
                break;
            }
        }
        return obj;
    }


    // 绑定编辑
    bindEdit() {
        let that = this;
        // 如果是线 面 则需要先选中
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) {
            if (!that.canEdit) return;
            // 若当前正在绘制 则无法进行编辑操作
            if (that.nowDrawEntityObj) return;
            let pick = that.viewer.scene.pick(evt.position);
            if (Cesium.defined(pick) && pick.id) { // 选中实体
                for (let i = 0; i < that.entityObjArr.length; i++) {
                    if (
                        pick.id.objId == that.entityObjArr[i].objId &&
                        (that.entityObjArr[i].state != "startCreate" ||
                            that.entityObjArr[i].state != "creating" ||
                            that.entityObjArr[i].state != "endEdit")
                    ) {
                        // 结束上一个实体的编辑操作
                        if (that.nowEditEntityObj) {
                            that.nowEditEntityObj.endEdit();
                            if (that.endEditFun) {
                                that.endEditFun(
                                    that.nowEditEntityObj,
                                    that.nowEditEntityObj.getEntity()
                                );
                            }
                            that.nowEditEntityObj = null;
                        }
                        // 开始当前实体的编辑
                        that.entityObjArr[i].startEdit(function () {
                            if (that.editingFun) that.editingFun(that.nowEditEntityObj, that.nowEditEntityObj.entity);
                        });
                        if (that.startEditFun) that.startEditFun(that.entityObjArr[i], pick.id); // 开始编辑
                        that.nowEditEntityObj = that.entityObjArr[i];
                        break;
                    }
                }
            } else {  // 未选中实体 则结束全部绘制
                if (that.nowEditEntityObj) {
                    that.nowEditEntityObj.endEdit();
                    if (that.endEditFun) {
                        that.endEditFun(
                            that.nowEditEntityObj,
                            that.nowEditEntityObj.getEntity()
                        );
                    }
                    that.nowEditEntityObj = undefined;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    // 绑定右键删除
    bindRemove() {
        let that = this;
        // 如果是线 面 则需要先选中
        if (!this.handler) this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (evt) {
            if (!that.canEdit) return;
            // 若当前正在绘制 则无法进行删除
            if (that.nowDrawEntityObj) return;
            let pick = that.viewer.scene.pick(evt.position);
            if (!pick || !pick.id) return;
            /* let selectEntobj = undefined; */
            /* for (let i = 0; i < that.entityObjArr.length; i++) {
        if (pick.id.objId == that.entityObjArr[i].objId) {
          selectEntobj = that.entityObjArr[i];
          break;
        }
      } */

            that.createDelteDom(evt.position, pick.id.objId);

        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    createDelteDom(px, objId) {
        if (!objId) return;
        let deleteDom = window.document.createElement("span");
        deleteDom.style.background = "rgba(0,0,0,0.5)";
        deleteDom.style.position = "absolute";
        deleteDom.style.color = "white";
        deleteDom.style.left = (px.x + 10) + "px";
        deleteDom.style.top = (px.y + 10) + "px";
        deleteDom.style.padding = "4px";
        deleteDom.style.cursor = "pointer";
        deleteDom.id = "easy3d-plot-delete";
        deleteDom.setAttribute("objId", objId);
        deleteDom.innerHTML = `删除`;
        let mapDom = window.document.getElementById(this.viewer.container.id);
        mapDom.appendChild(deleteDom);

        const clsBtn = window.document.getElementById("easy3d-plot-delete");
        if (!clsBtn) return;
        let that = this;
        clsBtn.addEventListener("click", (e) => {
            let id = deleteDom.getAttribute("objId");
            that.removeByObjId(id);
        });
        document.addEventListener("click", function () {
            clsBtn.remove();
        });
    }

    /**
     * 结束编辑
     */
    endEdit() {
        if (this.nowEditEntityObj) {
            // 结束除当前选中实体的所有编辑操作
            this.nowEditEntityObj.endEdit();
            if (this.endEditFun) {
                this.endEditFun(
                    this.nowEditEntityObj,
                    this.nowEditEntityObj.getEntity()
                ); // 结束事件
            }
            this.nowEditEntityObj = null;
        }
        for (let i = 0; i < this.entityObjArr.length; i++) {
            this.entityObjArr[i].endEdit();
        }
    }

    done() {
        if (this.nowEditEntityObj) {
            this.nowEditEntityObj.done();
            if (this.endEditFun) this.endEditFun(this.nowEditEntityObj, this.nowEditEntityObj.getEntity());
            this.nowEditEntityObj = undefined;
        }

        if (this.nowDrawEntityObj) {
            this.nowDrawEntityObj.done();
            this.entityObjArr.push(this.nowDrawEntityObj);
            if (this.endCreateFun) this.endCreateFun(this.nowDrawEntityObj, this.nowDrawEntityObj.getEntity());
            this.nowDrawEntityObj = undefined;
        }
    }


    /**
     * 获取当前所有对象
     * @returns {Array} entityObjArr
     */
    getEntityObjArr() {
        return this.entityObjArr;
    }
    createByType(opt) {
        let entityObj = undefined;
        let name = "";
        opt = opt || {};
        if (opt.type == "polyline") {
            entityObj = new CreatePolyline(this.viewer, opt.style);
            name = "折线_";
        }

        if (opt.type == "polygon") {
            entityObj = new CreatePolygon(this.viewer, opt.style);
            name = "面_";
        }

        if (opt.type == "billboard") {
            entityObj = new CreateBillboard(this.viewer, opt.style);
            name = "图标_";
        }

        if (opt.type == "circle") {
            entityObj = new CreateCircle(this.viewer, opt.style);
            name = "圆_";
        }

        if (opt.type == "rectangle") {
            entityObj = new CreateRectangle(this.viewer, opt.style);
            name = "矩形_";
        }

        if (opt.type == "gltfModel") {
            entityObj = new CreateGltfModel(this.viewer, opt.style);
            name = "模型_";
        }

        if (opt.type == "point") {
            entityObj = new CreatePoint(this.viewer, opt.style);
            name = "点_";
        }
        if (opt.type == "label") {
            entityObj = new CreateLabel(this.viewer, opt.style);
            name = "文字_";
        }

        // ========== 以下为付费功能 ==============
        // if (opt.type == "arrow") {
        //   /**
        //   * situationType值及对应的类型：
        //   *  	1-攻击箭头 2-攻击箭头（平尾）3-攻击箭头（燕尾）4-闭合曲面 5-钳击箭头
        //   * 		6-单尖直箭头 7-粗单尖直箭头(带燕尾) 8-集结地 9-弓形面 10-直箭头
        //   * 		11-矩形旗 12-扇形 13-三角旗 14-矩形波浪旗 17-多边形 18-圆形
        //   */
        //   if (!opt.arrowType) {
        //     console.log("缺少军事标绘类型");
        //     return;
        //   }
        //   entityObj = new CreateArrow(this.viewer, opt.arrowType, opt.style);
        // }

        if (entityObj) entityObj.name = name + new Date().getTime();
        return entityObj;
    }
}



