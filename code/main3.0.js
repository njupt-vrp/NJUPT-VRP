/*外部函数 github上抄来的
////////////////////
/* FileSaver.js
* A saveAs() FileSaver implementation.
* 1.1.20151003
*
* By Eli Grey, http://eligrey.com
* License: MIT
*   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
*/

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
    "use strict";
    // IE <10 is explicitly unsupported
    if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
        return;
    }
    var
        doc = view.document
        // only get URL when necessary in case Blob.js hasn't overridden it yet
        ,
        get_URL = function() {
            return view.URL || view.webkitURL || view;
        },
        save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a"),
        can_use_save_link = "download" in save_link,
        click = function(node) {
            var event = new MouseEvent("click");
            node.dispatchEvent(event);
        },
        is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent),
        webkit_req_fs = view.webkitRequestFileSystem,
        req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem,
        throw_outside = function(ex) {
            (view.setImmediate || view.setTimeout)(function() {
                throw ex;
            }, 0);
        },
        force_saveable_type = "application/octet-stream",
        fs_min_size = 0
        // See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
        // https://github.com/eligrey/FileSaver.js/commit/485930a#commitcomment-8768047
        // for the reasoning behind the timeout and revocation flow
        ,
        arbitrary_revoke_timeout = 500 // in ms
        ,
        revoke = function(file) {
            var revoker = function() {
                if (typeof file === "string") { // file is an object URL
                    get_URL().revokeObjectURL(file);
                } else { // file is a File
                    file.remove();
                }
            };
            if (view.chrome) {
                revoker();
            } else {
                setTimeout(revoker, arbitrary_revoke_timeout);
            }
        },
        dispatch = function(filesaver, event_types, event) {
            event_types = [].concat(event_types);
            var i = event_types.length;
            while (i--) {
                var listener = filesaver["on" + event_types[i]];
                if (typeof listener === "function") {
                    try {
                        listener.call(filesaver, event || filesaver);
                    } catch (ex) {
                        throw_outside(ex);
                    }
                }
            }
        },
        auto_bom = function(blob) {
            // prepend BOM for UTF-8 XML and text/* types (including HTML)
            if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
                return new Blob(["\ufeff", blob], {
                    type: blob.type
                });
            }
            return blob;
        },
        FileSaver = function(blob, name, no_auto_bom) {
            if (!no_auto_bom) {
                blob = auto_bom(blob);
            }
            // First try a.download, then web filesystem, then object URLs
            var
                filesaver = this,
                type = blob.type,
                blob_changed = false,
                object_url, target_view, dispatch_all = function() {
                    dispatch(filesaver, "writestart progress write writeend".split(" "));
                }
                // on any filesys errors revert to saving with object URLs
                ,
                fs_error = function() {
                    if (target_view && is_safari && typeof FileReader !== "undefined") {
                        // Safari doesn't allow downloading of blob urls
                        var reader = new FileReader();
                        reader.onloadend = function() {
                            var base64Data = reader.result;
                            target_view.location.href = "data:attachment/file" + base64Data.slice(base64Data.search(/[,;]/));
                            filesaver.readyState = filesaver.DONE;
                            dispatch_all();
                        };
                        reader.readAsDataURL(blob);
                        filesaver.readyState = filesaver.INIT;
                        return;
                    }
                    // don't create more object URLs than needed
                    if (blob_changed || !object_url) {
                        object_url = get_URL().createObjectURL(blob);
                    }
                    if (target_view) {
                        target_view.location.href = object_url;
                    } else {
                        var new_tab = view.open(object_url, "_blank");
                        if (new_tab == undefined && is_safari) {
                            //Apple do not allow window.open, see http://bit.ly/1kZffRI
                            view.location.href = object_url
                        }
                    }
                    filesaver.readyState = filesaver.DONE;
                    dispatch_all();
                    revoke(object_url);
                },
                abortable = function(func) {
                    return function() {
                        if (filesaver.readyState !== filesaver.DONE) {
                            return func.apply(this, arguments);
                        }
                    };
                },
                create_if_not_found = {
                    create: true,
                    exclusive: false
                },
                slice;
            filesaver.readyState = filesaver.INIT;
            if (!name) {
                name = "download";
            }
            if (can_use_save_link) {
                object_url = get_URL().createObjectURL(blob);
                setTimeout(function() {
                    save_link.href = object_url;
                    save_link.download = name;
                    click(save_link);
                    dispatch_all();
                    revoke(object_url);
                    filesaver.readyState = filesaver.DONE;
                });
                return;
            }
            // Object and web filesystem URLs have a problem saving in Google Chrome when
            // viewed in a tab, so I force save with application/octet-stream
            // http://code.google.com/p/chromium/issues/detail?id=91158
            // Update: Google errantly closed 91158, I submitted it again:
            // https://code.google.com/p/chromium/issues/detail?id=389642
            if (view.chrome && type && type !== force_saveable_type) {
                slice = blob.slice || blob.webkitSlice;
                blob = slice.call(blob, 0, blob.size, force_saveable_type);
                blob_changed = true;
            }
            // Since I can't be sure that the guessed media type will trigger a download
            // in WebKit, I append .download to the filename.
            // https://bugs.webkit.org/show_bug.cgi?id=65440
            if (webkit_req_fs && name !== "download") {
                name += ".download";
            }
            if (type === force_saveable_type || webkit_req_fs) {
                target_view = view;
            }
            if (!req_fs) {
                fs_error();
                return;
            }
            fs_min_size += blob.size;
            req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
                fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
                    var save = function() {
                        dir.getFile(name, create_if_not_found, abortable(function(file) {
                            file.createWriter(abortable(function(writer) {
                                writer.onwriteend = function(event) {
                                    target_view.location.href = file.toURL();
                                    filesaver.readyState = filesaver.DONE;
                                    dispatch(filesaver, "writeend", event);
                                    revoke(file);
                                };
                                writer.onerror = function() {
                                    var error = writer.error;
                                    if (error.code !== error.ABORT_ERR) {
                                        fs_error();
                                    }
                                };
                                "writestart progress write abort".split(" ").forEach(function(event) {
                                    writer["on" + event] = filesaver["on" + event];
                                });
                                writer.write(blob);
                                filesaver.abort = function() {
                                    writer.abort();
                                    filesaver.readyState = filesaver.DONE;
                                };
                                filesaver.readyState = filesaver.WRITING;
                            }), fs_error);
                        }), fs_error);
                    };
                    dir.getFile(name, {
                        create: false
                    }, abortable(function(file) {
                        // delete file if it already exists
                        file.remove();
                        save();
                    }), abortable(function(ex) {
                        if (ex.code === ex.NOT_FOUND_ERR) {
                            save();
                        } else {
                            fs_error();
                        }
                    }));
                }), fs_error);
            }), fs_error);
        },
        FS_proto = FileSaver.prototype,
        saveAs = function(blob, name, no_auto_bom) {
            return new FileSaver(blob, name, no_auto_bom);
        };
    // IE 10+ (native saveAs)
    if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
        return function(blob, name, no_auto_bom) {
            if (!no_auto_bom) {
                blob = auto_bom(blob);
            }
            return navigator.msSaveOrOpenBlob(blob, name || "download");
        };
    }

    FS_proto.abort = function() {
        var filesaver = this;
        filesaver.readyState = filesaver.DONE;
        dispatch(filesaver, "abort");
    };
    FS_proto.readyState = FS_proto.INIT = 0;
    FS_proto.WRITING = 1;
    FS_proto.DONE = 2;

    FS_proto.error =
        FS_proto.onwritestart =
        FS_proto.onprogress =
        FS_proto.onwrite =
        FS_proto.onabort =
        FS_proto.onerror =
        FS_proto.onwriteend =
        null;

    return saveAs;
}(
    typeof self !== "undefined" && self || typeof window !== "undefined" && window || this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
    module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
    define([], function() {
        return saveAs;
    });
}


////////////////////
//全局变量
////////////////////
width = 600;
height = 600;
bstart = false; //是否开始动画
bend = false; //是否运输完毕
carstep = 1; //车辆每次更新的步长（像素长度）
Rcar = 5, Rplace = 8; //车辆半价，城市半径的像素长度
maxboardx = 520; //字x坐标最大值
maxboardy = 595; //字y坐标最大值
minboard = 0; //字坐标最小值
jobbfinished = 0; //用于计数已经完成的mjob对象
totaljobnum = 0; //一共的mjob对象个数
pathlengthstr = "null"; //结束后显示货车路程数的字符串

snum = 0;
dnum = 0;
tnum = 0;
bselfdefine = false;
bshow = false;

jsonstr = "";
inputjsonstr = "";

jsonroot = null;
mvec = new Array(); //mcity[] 供应地数组
nvec = new Array(); //mcity[] 需求地数组
truckvec = new Array(); //mtruck[] 货车数组
missionvec = new Array(); //mtruckmission[] 总任务数组
pathlengthvec = new Array(); //float[] 车辆总路程数组

pathstrvec = new Array(); //string数组的数组 
stateindexvec = new Array(); //int[] 目前状态栏更新index数组
bfirstupdatevec = new Array(); //bool[] 车辆是否第一次更新数组
var colorvec2 = new Array();
console.log(colorvec2);

initposvec = new Array(); //mpos[] 存放出发地数字
endsorinumvec = new Array(); //int[] 存放需求地原始数据
drawroutevec = new Array(); //mline[] 存放目前需要画出虚线的路径
anivec = new Array(); //manimation[] 存放数字隐去动画
////////////////////

function mrand(under, over) {
    return parseInt(Math.random() * (over - under) + under);
}

//类 坐标类
var mpos = {
    make:
    //构造函数 (double,double) vx:x坐标值 vy:y坐标值 
        function(vx, vy) {
        var tpos = {};
        tpos.posx = vx; //成员变量 x坐标值
        tpos.posy = vy; //成员变量 y坐标值
        return tpos;
    }
};

//类 线段类
var mline = {
    make:
    //构造函数 (mpos,mpos)
        function(vstartpos, vendpos) {
        var tline = {};
        tline.startpos = vstartpos;
        tline.endpos = vendpos;
        return tline;
    }
};

//类 数字隐去的动画类
var manimation = {
    make:
    //构造函数 (int,float)
        function(vchangenum, valpha, vposx, vposy) {
        var tani = {};
        tani.changenum = vchangenum;
        tani.alpha = valpha;
        tani.posx = vposx;
        tani.posy = vposy;
        return tani;
    }
};

//函数 double(mpos,mpos) 返回两坐标距离
function PosDis(vpos1, vpos2) {
    return Math.sqrt(Math.pow(vpos1.posx - vpos2.posx, 2) + Math.pow(vpos1.posy - vpos2.posy, 2)); //传统距离
}

//函数 bool(mpos,mpos) 返回两坐标是否几乎重合
function SamePos(vpos1, vpos2) {
    if (vpos1.posx == vpos2.posx && vpos1.posy == vpos2.posy) {
        return 1;
    } else if (PosDis(vpos1, vpos2) <= 1) {
        return 1;
    } else {
        return 0;
    }
}

//类 城市类
var mcity = {
    make:
    //构造函数 (mpos,string,int) vpos:城市坐标 vflag:"m"代表供应城市,"n"代表需求城市 vnumber:城市number 
        function(vpos, vflag, vnumber) {
        var tcity = {};
        tcity.pos = vpos; //成员变量 城市坐标
        tcity.flag = vflag; //成员变量 是哪种城市的标识
        tcity.number = vnumber; //成员变量 城市的number
        return tcity;
    }
};

//类 货车类
var mtruck = {
    make:
    //构造函数 (mpos,int) vpos:车辆坐标 vcapacity:车上目前载量
        function(vpos, vcapacity) {
        var ttruck = {};
		ttruck.capacity=vcapacity;
        ttruck.pos = vpos; //成员变量 车辆坐标
        ttruck.nowload = 0; //成员变量 车上目前载量
        ttruck.bdrive = true;
        ttruck.mupdate =
            //成员函数 int(mjob) 根据job更新车辆及城市状态，如果到达返回1，否则返回0
            function(vjob) {
                this.pos.posx += vjob.deltax;
                this.pos.posy += vjob.deltay;
                if (this.bdrive == true) {
                    this.bdrive = false;
                    //刚出发，更改车上的capacity和城市的number
                    this.nowload = vjob.nowload;
                    if (IsCity(vjob.startpos)) {
                        FindCityByPos(vjob.startpos).number += vjob.number;
                        anivec.push(manimation.make(vjob.number, 1.0, vjob.startpos.posx, vjob.startpos.posy));
                    }
                }
                if (vjob.targetname == "null") {
                    //目标地为"null"
                    return 1;
                } else if (SamePos(this.pos, FindCityPos(vjob.targetname))) {
                    //到达目的地
                    this.bdrive = true;
                    return 1;
                } else {
                    //车子还在路上，无需改变什么
                }
                return 0;
            };
        return ttruck;
    }
};

//类 任务类
var mjob = {
    make:
    //构造函数 (mpos,string,int,int) vstartpos:车辆出发坐标 vtargetname:目标城市名字 vnumber:此次载/卸货物量（正为载，负为卸） vnowload:任务完成后车辆载量
        function(vstartpos, vtargetname, vnumber, vnowload) {
        var tjob = {};
        tjob.startpos = vstartpos; //成员变量 车辆出发坐标
        tjob.targetname = vtargetname; //成员变量 目标城市名字
        tjob.number = vnumber; //成员变量 此次载/卸货物量
        tjob.nowload = vnowload; //成员变量 任务完成后车辆载量

        tjob.deltax = 666; //成员变量 每次更新车辆的x坐标变化
        tjob.deltay = 999; //成员变量 每次更新车辆的y坐标变化
        //事先计算出每次更新车辆的deltax,deltay
        var tmovdir = 1;
        var ax = vstartpos.posx;
        var ay = vstartpos.posy;
        var bx = 666;
        var by = 999;

        if (vtargetname == "null") {
            bx = ax;
            by = ay;
        } else {
            var tpos = FindCityPos(vtargetname);
            bx = tpos.posx;
            by = tpos.posy;
        }

        if (Math.abs(ax - bx) <= 0.5) {
            tjob.deltax = 0;
            if (by - ay > 0) {
                tjob.deltay = carstep;
            } else {
                tjob.deltay = -carstep;
            }
        } else if (Math.abs(ay - by) <= 0.5) {
            tjob.deltay = 0;
            if (bx - ax > 0) {
                tjob.deltax = carstep;
            } else {
                tjob.deltax = -carstep;
            }
        } else {
            if (ax > bx) {
                tmovdir = -1;
            }

            var k = (ay - by) / (ax - bx);
            var b = ay - k * ax;
            var dx = carstep * Math.cos(Math.atan(-k));
            if (tmovdir == 1) {
                tjob.deltax = dx;
                tjob.deltay = k * dx;
            } else if (tmovdir == -1) {
                tjob.deltax = -dx;
                tjob.deltay = -k * dx;
            }
        }

        return tjob;
    }
};

//类 货车总任务类
var mtruckmission = {
    make:
    //构造函数 () 
        function() {
        var ttruckmission = {};
        ttruckmission.jobarr = new Array(); //成员变量 任务数组
        ttruckmission.nowindex = 0; //成员变量 任务做到哪个的下标
        ttruckmission.thistruck = {}; //成员变量 此车
        ttruckmission.bfinish = 0; //成员变量 当前任务是否完成
        return ttruckmission;
    }
};



//特殊函数 状态栏初始化函数
function cartrait(vcarindex) {
    $(".state").append('<div class="carname">' + "T" + String(vcarindex + 1) + '</div>' + '<div class="check"><i class="imooc-icon icon-check"></i></div>');
    $(".state").append('<div class="block" style="display:none;"></div>');
    for (var iter = 0; iter < pathstrvec[vcarindex].length; iter++) {
        $(".state").append(
            '<div class="dot-container"><div class="dot"></div><div class="cityname">' + pathstrvec[vcarindex][iter] + '</div></div><div class="block"></div>'
        );
    }
    $(".block:last").remove();
    // 更改颜色
    for (var j = 0; j < pathstrvec[vcarindex].length; j++) {
        switch (colorvec2[vcarindex][j]) {
            case "red":
                $('.state .carname').eq(vcarindex).nextUntil('.carname', '.dot-container').eq(j).find(".dot").addClass("dot-red");
                break;
            case "yellow":
                $('.state .carname').eq(vcarindex).nextUntil('.carname', '.dot-container').eq(j).find(".dot").addClass("dot-yellow");
                break;
            case "green":
                $('.state .carname').eq(vcarindex).nextUntil('.carname', '.dot-container').eq(j).find(".dot").addClass("dot-green");
                break;
            default:
                break;
        }
    }
}

//函数 void() 初始化部分全局变量
function minit() {
    missionvec = [];
    totaljobnum = 0;
    jobbfinished = 0;
    bend = false;
    pathlengthstr = "";
    pathlengthvec = [];
    pathstrvec = [];
    stateindexvec = [];
    bfirstupdatevec = [];
    initposvec = [];

    //初始化endsorinumvec
    for (var iter = 0; iter < nvec.length; iter++) {
        endsorinumvec[iter] = nvec[iter].number;
    }

    //初始化missionvec,并填充missionvec中的每个thiscar
    for (var iter = 0; iter < tnum; iter++) {
        missionvec[iter] = mtruckmission.make();
        missionvec[iter].thistruck = truckvec[iter];
    }
    //初始化stateindexvec
    for (var iter = 0; iter < tnum; iter++) {
        stateindexvec[iter] = 0;
    }

    //初始化bfirstupdatevec
    for (var iter = 0; iter < bfirstupdatevec; iter++) {
        bfirstupdatevec[iter] = false;
    }

    //清空状态栏
    $(".state").empty();
}

/////////////////////////////////////////////
function minit2() {
    //填充missionvec中的每个车的jobarr
    for (var carname = 1; carname <= tnum; carname++) {
        for (var iter = 0; iter < jsonroot.record.length; iter++) {
            if (jsonroot.record[iter].truckid == carname) {
                var tstartpos = {};
                if (!$.isArray(jsonroot.record[iter].source)) {
                    tstartpos = FindCityPos(String(jsonroot.record[iter].source));
                } else {
                    tstartpos = mpos.make(parseInt(jsonroot.record[iter].source[0]), parseInt(jsonroot.record[iter].source[1]));
                }
                missionvec[carname - 1].jobarr.push(
                    mjob.make(
                        tstartpos,
                        String(jsonroot.record[iter].target),
                        parseInt(-Math.abs(jsonroot.record[iter].number)),
                        parseInt(jsonroot.record[iter].nowload)
                    )
                );
                totaljobnum += 1;
            }
        }
    }
    var tmaxlength = 0; //float
    //填充pathlengthstr
    for (var iter = 0; iter < jsonroot.pathlist.length; iter++) {
        var tnodevec = new Array(); //mpos[] 临时变量
        colorvec2[iter] = new Array();
        for (var iter2 = 0; iter2 < jsonroot.pathlist[iter].path.length; iter2++) {
            if ($.isArray(jsonroot.pathlist[iter].path[iter2])) {
                tnodevec.push(mpos.make(parseInt(jsonroot.pathlist[iter].path[iter2][0]), parseInt(jsonroot.pathlist[iter].path[iter2][1])));
                colorvec2[iter].push("yellow");
            } else {
                var tcname = String(jsonroot.pathlist[iter].path[iter2]);
                tnodevec.push(FindCityPos(tcname));
                if (tcname.charAt(0) == "m") {
                    colorvec2[iter].push("green");
                } else if (tcname.charAt(0) == "n") {
                    colorvec2[iter].push("red");
                } else {
                    alert("City Name Error At minit");
                }
            }
        }
        var ttemlength = 0;
        //计算tnodevec中各点距离之和
        for (var iter2 = 0; iter2 < tnodevec.length - 1; iter2++) {
            ttemlength += PosDis(tnodevec[iter2], tnodevec[iter2 + 1]);
        }
        if (ttemlength > tmaxlength) {
            tmaxlength = ttemlength;
        }
    }
    pathlengthstr = "time is " + tmaxlength.toFixed(1) + " ,time of algorithm is " + jsonroot.time.toFixed(3);

    //填充pathstrvec
    for (var iter = 0; iter < jsonroot.pathlist.length; iter++) {
        pathstrvec[iter] = new Array();
        for (var iter2 = 0; iter2 < jsonroot.pathlist[iter].path.length; iter2++) {
            if ($.isArray(jsonroot.pathlist[iter].path[iter2])) {
                pathstrvec[iter].push("Start");
                initposvec.push(mpos.make(parseInt(jsonroot.pathlist[iter].path[iter2][0]), parseInt(jsonroot.pathlist[iter].path[iter2][1])));
            } else {
                var tname = String(jsonroot.pathlist[iter].path[iter2]);
                if (tname.charAt(0) == "m") {
                    pathstrvec[iter].push("S" + tname.substr(1, tname.length - 1));
                } else {
                    pathstrvec[iter].push("D" + tname.substr(1, tname.length - 1));
                }
            }
        }
    }

    for (var iter = 0; iter < jsonroot.pathlist.length; iter++) {
        cartrait(iter);
    }

}

//函数 mpos(string) 根据城市名返回其坐标
function FindCityPos(vcityname) {
    if (vcityname == "null") {
        alert("city name is null to find pos");
        return 0;
    }
    if (vcityname.charAt(0) == "m") {
        var mcityid = parseInt(vcityname.substr(1));
        return mvec[mcityid - 1].pos;
    } else if (vcityname.charAt(0) == "n") {
        var ncityid = parseInt(vcityname.substr(1));
        return nvec[ncityid - 1].pos;
    } else {
        alert("city name error,name:" + vcityname);
    }
}

//函数 mcity(string) 根据城市名返回城市
function FindCity(vcityname) {
    if (vcityname == "null") {
        alert("city name is null to find pos");
        return 0;
    }
    if (vcityname.charAt(0) == "m") {
        var mcityid = parseInt(vcityname.substr(1));
        return mvec[mcityid - 1];
    } else if (vcityname.charAt(0) == "n") {
        var ncityid = parseInt(vcityname.substr(1));
        return nvec[ncityid - 1];
    } else {
        alert("city name error");
    }
}

//函数 bool(mpos) vpos:坐标 在此坐标上是否有城市
function IsCity(vpos) {
    for (var iter = 0; iter < mvec.length; iter++) {
        if (SamePos(vpos, mvec[iter].pos)) {
            return true;
        }
    }
    for (var iter = 0; iter < nvec.length; iter++) {
        if (SamePos(vpos, nvec[iter].pos)) {
            return true;
        }
    }
    return false;
}

//函数 mcity(mpos) vpos:坐标 根据坐标返回在此的城市
function FindCityByPos(vpos) {
    for (var iter = 0; iter < mvec.length; iter++) {
        if (SamePos(vpos, mvec[iter].pos)) {
            return mvec[iter];
        }
    }
    for (var iter = 0; iter < nvec.length; iter++) {
        if (SamePos(vpos, nvec[iter].pos)) {
            return nvec[iter];
        }
    }
    alert("find city by pos error");
}

//jquery响应函数 当页面准备好时
$(document).ready(function() {
    //全局变量
    ////////////////////
    ctx = $("#myCanvas")[0].getContext("2d");
    ////////////////////
    //jquery响应函数 当“开始”按钮被按下
    $("#istart").click(function() {
        // minit2();
        bstart = true;
    });

    $("#idownload").click(function() {
        var blob = new Blob([inputjsonstr], {
            type: "text/plain;charset=utf-8"
        });
        saveAs(blob, "inputjson.txt");
    });

    var count_ = 0;
    $("#ipause").click(function() {
        bstart = !bstart;
        count_++;
        if (count_ % 2 === 0) {
            $("#ipause").html("Pause");
        } else if (count_ % 2 === 1) {
            $("#ipause").html("Continue");
        }
    });

    $(".downslide").on("click", function() {
        $(".slide-container").toggleClass("slide-container-down");
        $(this).toggleClass("downslide-up");
    });

    $(".navigation1 li").click(function() {
        $(".navigation1 li").removeClass("active");
        $(this).addClass("active");
    });

    var schemeChoose = '';
    $(".list1 li").click(function() {
        $(".list1 li").removeClass("active");
        $(this).addClass("active");
        bshow = false;
        bselfdefine = false;
        schemeChoose = this.dataset.scheme;
        if (schemeChoose == '3-3-2') {
            jsonstr = '{\
                "record":\
                    [{\
                        "truckid":1,\
                        "source":[150,70],\
                       "target":"m1",\
                       "number":0,\
                       "nowload":0\
                    },\
                    {\
                       "truckid":1,\
                       "source":"m1",\
                       "target":"n1",\
                       "number":2,\
                       "nowload":2\
                    },\
                   {\
                       "truckid":1,\
                       "source":"n1",\
                       "target":"m1",\
                        "number":-2,\
                        "nowload":0\
                    },\
                    {\
                        "truckid":1,\
                        "source":"m1",\
                       "target":"n1",\
                       "number":1,\
                       "nowload":1\
                   },\
                   {\
                       "truckid":1,\
                       "source":"n1",\
                       "target":"null",\
                       "number":-1,\
                       "nowload":0\
                   },\
                   {\
                       "truckid":2,\
                       "source":[120,150],\
                       "target":"m3",\
                       "number":0,\
                       "nowload":0\
                   },\
                   {\
                       "truckid":2,\
                       "source":"m3",\
                       "target":"n2",\
                       "number":2,\
                       "nowload":2\
                   },\
                   {\
                       "truckid":2,\
                       "source":"n2",\
                       "target":"m3",\
                       "number":-2,\
                       "nowload":0\
                   },\
                   {\
                       "truckid":2,\
                       "source":"m3",\
                       "target":"n3",\
                       "number":1,\
                       "nowload":1\
                   },\
                   {\
                       "truckid":2,\
                       "source":"n3",\
                       "target":"null",\
                       "number":-1,\
                       "nowload":0\
                   }\
                   ]\
                   ,\
                   "pathlist":\
                   [\
                   {\
                       "truckid":1,\
                       "path":[[150,70],"m1","n1","m1","n1"]\
                   },\
                   {\
                       "truckid":2,\
                       "path":[[120,150],"m3","n2","m3","n3"]\
                   }\
                   ]\
                   ,\
                   "time":2.345\
            }';
            inputjsonstr = '\
               {\
                  "sourcelist":[ \
                  {\
                     "x":100,\
                     "y":30,\
                     "num":6\
                 },\
                 {\
                     "x":70,\
                     "y":50,\
                     "num":5\
                 },\
                 {\
                     "x":30,\
                     "y":100,\
                     "num":4\
                 }\
                 ],\
                 "targetlist":[\
                 {\
                     "x":200,\
                     "y":30,\
                     "num":3\
                 },\
                 {\
                     "x":180,\
                     "y":70,\
                     "num":2\
                 }\
                 ,\
                 {\
                     "x":250,\
                     "y":200,\
                     "num":1\
                 }\
                 ],\
                 "trucklist":[\
                 {\
                     "x":150,\
                     "y":70,\
                     "capacity":2\
                 },\
                 {\
                     "x":120,\
                     "y":150,\
                     "capacity":2\
                 }\
                 ]\
             }';
            jsonroot = jQuery.parseJSON(jsonstr);
            snum = 3;
            dnum = 3;
            tnum = 2;
            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(100, 30), "m", 6);
            mvec[1] = mcity.make(mpos.make(70, 50), "m", 5);
            mvec[2] = mcity.make(mpos.make(30, 100), "m", 4);
            nvec[0] = mcity.make(mpos.make(200, 30), "n", 3);
            nvec[1] = mcity.make(mpos.make(180, 70), "n", 2);
            nvec[2] = mcity.make(mpos.make(250, 200), "n", 1)
            truckvec[0] = mtruck.make(mpos.make(150, 70), 2);
            truckvec[1] = mtruck.make(mpos.make(120, 150), 2);

            document.getElementById("inputS").value = 3;
            document.getElementById("inputD").value = 3;
            document.getElementById("inputT").value = 2;
        } else if (schemeChoose == '5-5-3') {
            //确定内置动画
            jsonstr = '{\
                     "record":\
                     [{\
                      "truckid":1,\
                      "source":[110,110],\
                      "target":"m2",\
                      "number":0,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":1,\
                      "source":"m2",\
                      "target":"n1",\
                      "number":2,\
                      "nowload":2\
                  },\
                  {\
                      "truckid":1,\
                      "source":"n1",\
                      "target":"m2",\
                      "number":-2,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":1,\
                      "source":"m2",\
                      "target":"n1",\
                      "number":1,\
                  "nowload":1\
                  },\
                  {\
                      "truckid":1,\
                      "source":"n1",\
                      "target":"m1",\
                      "number":-1,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":1,\
                      "source":"m1",\
                      "target":"n2",\
                      "number":2,\
                      "nowload":2\
                  },\
                  {\
                      "truckid":1,\
                      "source":"n2",\
                      "target":"null",\
                      "number":-2,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":2,\
                      "source":[300,300],\
                      "target":"m5",\
                      "number":0,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":2,\
                      "source":"m5",\
                      "target":"n3",\
                      "number":2,\
                      "nowload":2\
                  },\
                  {\
                      "truckid":2,\
                      "source":"n3",\
                      "target":"null",\
                      "number":-2,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":3,\
                      "source":[490,490],\
                      "target":"m4",\
                      "number":0,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":3,\
                      "source":"m4",\
                  "target":"n4",\
                  "number":2,\
                  "nowload":2\
                  },\
                  {\
                      "truckid":3,\
                      "source":"n4",\
                      "target":"m4",\
                      "number":-2,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":3,\
                      "source":"m4",\
                      "target":"n4",\
                      "number":1,\
                      "nowload":1\
                  },\
                  {\
                      "truckid":3,\
                      "source":"n4",\
                      "target":"m3",\
                      "number":-1,\
                      "nowload":0\
                  },\
                  {\
                      "truckid":3,\
                      "source":"m3",\
                      "target":"n5",\
                  "number":2,\
                  "nowload":2\
                  },\
                  {\
                      "truckid":3,\
                      "source":"n5",\
                      "target":"null",\
                      "number":0,\
                      "nowload":0\
                  }\
                  ]\
                  ,\
                  "pathlist":\
                  [\
                  {\
                      "truckid":1,\
                      "path":[[110,110],"m2","n1","m2","n1","m1","n2"]\
                  },\
                  {\
                      "truckid":2,\
                      "path":[[300,300],"m5","n3"]\
                  },\
                  {\
                      "truckid":3,\
                      "path":[[490,490],"m4","n4","m4","n4","m3","n5"]\
                  }\
                  ]\
                  ,\
                  "time":2.345} ';
            //确定内置datajson
            inputjsonstr = '\
                  {\
                     "sourcelist":[ \
                     {\
                      "x":100,\
                      "y":100,\
                      "num":2\
                  },\
                  {\
                      "x":120,\
                      "y":120,\
                      "num":3\
                  },\
                  {\
                      "x":480,\
                      "y":480,\
                      "num":2\
                  },\
                  {\
                      "x":500,\
                      "y":500,\
                      "num":3\
                  },\
                  {\
                      "x":200,\
                      "y":200,\
                      "num":2\
                  }\
                  ],\
                  "targetlist":[\
                  {\
                      "x":100,\
                      "y":120,\
                      "num":3\
                  },\
                  {\
                      "x":120,\
                      "y":100,\
                      "num":2\
                  },\
                  {\
                      "x":400,\
                      "y":400,\
                      "num":2\
                  },\
                  {\
                      "x":480,\
                      "y":500,\
                      "num":3\
                  }\
                  ,\
                  {\
                      "x":500,\
                      "y":480,\
                      "num":2\
                  }\
                  ],\
                  "trucklist":[\
                  {\
                      "x":110,\
                      "y":110,\
                      "capacity":2\
                  },\
                  {\
                      "x":300,\
                      "y":300,\
                      "capacity":2\
                  },\
                  {\
                      "x":490,\
                      "y":490,\
                      "capacity":2\
                  }\
                  ]\
                }';

            jsonroot = jQuery.parseJSON(jsonstr);

            snum = 5;
            dnum = 5;
            tnum = 3;

            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(100, 100), "m", 2);
            mvec[1] = mcity.make(mpos.make(120, 120), "m", 3);
            mvec[2] = mcity.make(mpos.make(480, 480), "m", 2);
            mvec[3] = mcity.make(mpos.make(500, 500), "m", 3);
            mvec[4] = mcity.make(mpos.make(200, 200), "m", 2);

            nvec[0] = mcity.make(mpos.make(100, 120), "n", 3);
            nvec[1] = mcity.make(mpos.make(120, 100), "n", 2);
            nvec[2] = mcity.make(mpos.make(400, 400), "n", 2);
            nvec[3] = mcity.make(mpos.make(480, 500), "n", 3);
            nvec[4] = mcity.make(mpos.make(500, 480), "n", 2);

            truckvec[0] = mtruck.make(mpos.make(110, 110), 2);
            truckvec[1] = mtruck.make(mpos.make(300, 300), 2);
            truckvec[2] = mtruck.make(mpos.make(490, 490), 2);

            document.getElementById("inputS").value = 5;
            document.getElementById("inputD").value = 5;
            document.getElementById("inputT").value = 3;
            
            
        } else if (schemeChoose == '10-10-5') {
            document.getElementById("inputS").value = 10;
            document.getElementById("inputD").value = 10;
            document.getElementById("inputT").value = 5;
			
			inputjsonstr='\
			{\
			"sourcelist":[\
                     {\
                      "x":318,\
                      "y":475,\
                      "num":5\
                  },\
                  {\
                      "x":296,\
                      "y":155,\
                      "num":5\
                  },\
                  {\
                      "x":150,\
                      "y":112,\
                      "num":5\
                  },\
                  {\
                      "x":225,\
                      "y":122,\
                      "num":5\
                  },\
                  {\
                      "x":324,\
                      "y":124,\
                      "num":2\
                  },\
                  {\
                      "x":50,\
                      "y":595,\
                      "num":7\
                  },\
                  {\
                      "x":516,\
                      "y":114,\
                      "num":9\
                  },\
                  {\
                      "x":296,\
                      "y":84,\
                      "num":8\
                  },\
                  {\
                      "x":293,\
                      "y":261,\
                      "num":4\
                  },\
                  {\
                      "x":298,\
                      "y":382,\
                      "num":5\
                  }\
                  ],\
                  "targetlist":[\
                  {\
                      "x":177,\
                      "y":480,\
                      "num":3\
                  },\
                  {\
                      "x":126,\
                      "y":116,\
                      "num":1\
                  },\
                  {\
                      "x":257,\
                      "y":199,\
                      "num":4\
                  },\
                  {\
                      "x":365,\
                      "y":596,\
                      "num":5\
                  },\
				  {\
                      "x":142,\
                      "y":19,\
                      "num":3\
                  },\
                  {\
                      "x":440,\
                      "y":279,\
                      "num":3\
                  },\
                  {\
                      "x":104,\
                      "y":400,\
                      "num":5\
                  },\
                  {\
                      "x":285,\
                      "y":383,\
                      "num":2\
                  },\
                  {\
                      "x":73,\
                      "y":23,\
                      "num":1\
                  },\
                  {\
                      "x":359,\
                      "y":309,\
                      "num":5\
                  }\
                  ],\
                  "trucklist":[\
                  {\
                      "x":598,\
                      "y":287,\
                      "capacity":2\
                  },\
                  {\
                      "x":446,\
                      "y":69,\
                      "capacity":2\
                  },\
                  {\
                      "x":180,\
                      "y":244,\
                      "capacity":2\
                  },\
                  {\
                      "x":361,\
                      "y":565,\
                      "capacity":2\
                  },\
                  {\
                      "x":335,\
                      "y":346,\
                      "capacity":2\
                  }\
                  ]\
                }';
			jsonstr='\
{\
"record":\
[{\
"truckid":1,\
"source":[598,287],\
"target":"m7",\
"number":0,\
"nowload":0\
},\
{\
"truckid":1,\
"source":"m7",\
"target":"n6",\
"number":2,\
"nowload":2\
},\
{\
"truckid":1,\
"source":"n6",\
"target":"m9",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":1,\
"source":"m9",\
"target":"n9",\
"number":2,\
"nowload":2\
},\
{\
"truckid":1,\
"source":"n9",\
"target":"m8",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":1,\
"source":"m8",\
"target":"n10",\
"number":2,\
"nowload":2\
},\
{\
"truckid":1,\
"source":"n10",\
"target":"null",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":2,\
"source":[446,69],\
"target":"m5",\
"number":0,\
"nowload":0\
},\
{\
"truckid":2,\
"source":"m5",\
"target":"n3",\
"number":2,\
"nowload":2\
},\
{\
"truckid":2,\
"source":"n3",\
"target":"m2",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":2,\
"source":"m2",\
"target":"n10",\
"number":2,\
"nowload":2\
},\
{\
"truckid":2,\
"source":"n10",\
"target":"m2",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":2,\
"source":"m2",\
"target":"n6",\
"number":1,\
"nowload":1\
},\
{\
"truckid":2,\
"source":"n6",\
"target":"m10",\
"number":-1,\
"nowload":0\
},\
{\
"truckid":2,\
"source":"m10",\
"target":"n8",\
"number":2,\
"nowload":2\
},\
{\
"truckid":2,\
"source":"n8",\
"target":"m10",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":2,\
"source":"m10",\
"target":"n4",\
"number":1,\
"nowload":1\
},\
{\
"truckid":2,\
"source":"n4",\
"target":"null",\
"number":-1,\
"nowload":0\
},\
{\
"truckid":3,\
"source":[180,244],\
"target":"m2",\
"number":0,\
"nowload":0\
},\
{\
"truckid":3,\
"source":"m2",\
"target":"n3",\
"number":2,\
"nowload":2\
},\
{\
"truckid":3,\
"source":"n3",\
"target":"m4",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":3,\
"source":"m4",\
"target":"n2",\
"number":2,\
"nowload":2\
},\
{\
"truckid":3,\
"source":"n2",\
"target":"m3",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":3,\
"source":"m3",\
"target":"n5",\
"number":2,\
"nowload":2\
},\
{\
"truckid":3,\
"source":"n5",\
"target":"m4",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":3,\
"source":"m4",\
"target":"n7",\
"number":2,\
"nowload":2\
},\
{\
"truckid":3,\
"source":"n7",\
"target":"m1",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":3,\
"source":"m1",\
"target":"n4",\
"number":2,\
"nowload":2\
},\
{\
"truckid":3,\
"source":"n4",\
"target":"null",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":4,\
"source":[361,565],\
"target":"m1",\
"number":0,\
"nowload":0\
},\
{\
"truckid":4,\
"source":"m1",\
"target":"n3",\
"number":1,\
"nowload":1\
},\
{\
"truckid":4,\
"source":"n3",\
"target":"m4",\
"number":-1,\
"nowload":0\
},\
{\
"truckid":4,\
"source":"m4",\
"target":"n5",\
"number":1,\
"nowload":1\
},\
{\
"truckid":4,\
"source":"n5",\
"target":"m3",\
"number":-1,\
"nowload":0\
},\
{\
"truckid":4,\
"source":"m3",\
"target":"n1",\
"number":2,\
"nowload":2\
},\
{\
"truckid":4,\
"source":"n1",\
"target":"m1",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":4,\
"source":"m1",\
"target":"n4",\
"number":2,\
"nowload":2\
},\
{\
"truckid":4,\
"source":"n4",\
"target":"null",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":5,\
"source":[335,346],\
"target":"m10",\
"number":0,\
"nowload":0\
},\
{\
"truckid":5,\
"source":"m10",\
"target":"n1",\
"number":2,\
"nowload":2\
},\
{\
"truckid":5,\
"source":"n1",\
"target":"m6",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":5,\
"source":"m6",\
"target":"n7",\
"number":2,\
"nowload":2\
},\
{\
"truckid":5,\
"source":"n7",\
"target":"m9",\
"number":-2,\
"nowload":0\
},\
{\
"truckid":5,\
"source":"m9",\
"target":"n10",\
"number":1,\
"nowload":1\
},\
{\
"truckid":5,\
"source":"n10",\
"target":"m9",\
"number":-1,\
"nowload":0\
},\
{\
"truckid":5,\
"source":"m9",\
"target":"n7",\
"number":1,\
"nowload":1\
},\
{\
"truckid":5,\
"source":"n7",\
"target":"null",\
"number":-1,\
"nowload":0\
}\
]\
,\
"pathlist":\
[\
{\
"truckid":1,\
"path":[[598,287],"m7","n6","m9","n9","m8","n10"]\
},\
{\
"truckid":2,\
"path":[[446,69],"m5","n3","m2","n10","m2","n6","m10","n8","m10","n4"]\
},\
{\
"truckid":3,\
"path":[[180,244],"m2","n3","m4","n2","m3","n5","m4","n7","m1","n4"]\
},\
{\
"truckid":4,\
"path":[[361,565],"m1","n3","m4","n5","m3","n1","m1","n4"]\
},\
{\
"truckid":5,\
"path":[[335,346],"m10","n1","m6","n7","m9","n10","m9","n7"]\
}\
]\
,\
"time":102.6190}';
            jsonroot = jQuery.parseJSON(jsonstr);

            snum = 10;
            dnum = 10;
            tnum = 5;

            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(318, 475), "m", 5);
            mvec[1] = mcity.make(mpos.make(296, 155), "m", 5);
            mvec[2] = mcity.make(mpos.make(150, 112), "m", 5);
            mvec[3] = mcity.make(mpos.make(225, 122), "m", 5);
            mvec[4] = mcity.make(mpos.make(324, 124), "m", 2);
			
			mvec[5] = mcity.make(mpos.make(50, 595), "m", 7);
			mvec[6] = mcity.make(mpos.make(516, 114), "m", 9);
			mvec[7] = mcity.make(mpos.make(296, 84), "m", 8);
			mvec[8] = mcity.make(mpos.make(293, 261), "m", 4);
			mvec[9] = mcity.make(mpos.make(298, 382), "m", 5);

            nvec[0] = mcity.make(mpos.make(177, 480), "n", 3);
            nvec[1] = mcity.make(mpos.make(126, 116), "n", 1);
            nvec[2] = mcity.make(mpos.make(257, 199), "n", 4);
            nvec[3] = mcity.make(mpos.make(365, 596), "n", 5);
            nvec[4] = mcity.make(mpos.make(142, 19), "n", 3);
			
			nvec[5] = mcity.make(mpos.make(440, 279), "n", 3);
			nvec[6] = mcity.make(mpos.make(104, 400), "n", 5);
			nvec[7] = mcity.make(mpos.make(285, 383), "n", 2);
			nvec[8] = mcity.make(mpos.make(73, 23), "n", 1);
			nvec[9] = mcity.make(mpos.make(359, 309), "n", 5);

            truckvec[0] = mtruck.make(mpos.make(598, 287), 2);
            truckvec[1] = mtruck.make(mpos.make(446, 69), 2);
            truckvec[2] = mtruck.make(mpos.make(180, 244), 2);
			truckvec[3] = mtruck.make(mpos.make(361, 565), 2);
			truckvec[4] = mtruck.make(mpos.make(335, 346), 2);

        } else {
            bselfdefine = true;
            schemeChoose = 'self-defined';
        }
    });

	$("#source-quantity").click(function() {
		bshow=false;
		for(var iter = 0; iter < $('#inputS').val(); iter++){
		var temnum=$("#inputSQ"+parseInt(iter + 1)).val();
		mvec[iter].number=temnum;
		if(temnum<0){
			alert("warning:num<0");
		}
		}
	});
	
	$("#demand-quantity").click(function() {
		bshow=false;
		for(var iter = 0; iter < $('#inputD').val(); iter++){
		var temnum=$("#inputDQ"+parseInt(iter + 1)).val();
		nvec[iter].number=temnum;
		if(temnum<0){
			alert("warning:num<0");
		}
		}
	});
	
	$("truck-capacity").click(function() {
		bshow=false;
		for(var i = 0; i < $('#inputT').val(); i++){
			var temnum=$("#inputTQ"+parseInt(iter + 1)).val();
		nvec[iter].number=temnum;
		if(temnum<0){
			alert("warning:num<0");
		}
		}
	});
	
    // 对刚才选择的schemeChoose进行判断
    // 点击具体数量填写按钮
    $('.sq').on('click', function() {
        if (schemeChoose === '') {
            alert('Please choose the scheme!');
        } else if (schemeChoose === 'self-defined') {
            // 如果选择了自定义模式，但是inputS框却是空的
            // 不弹出模态框
            if (!$('#inputS').val()) {
                alert('Please input Source Quantity');
                return;
            }
            $('#mysq .modal-body').empty();
            for (var i = 0; i < $('#inputS').val(); i++) {
                $('#mysq .modal-body').append(' <div class="form-group inputsq">' +
                    '<label for="inputsq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Source Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputSQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
            $('#mysq').modal();
        } else {
            var s = schemeChoose.split('-');
            $('#mysq .modal-body').empty();
            for (var i = 0; i < s[0]; i++) {
                $('#mysq .modal-body').append(' <div class="form-group inputsq">' +
                    '<label for="inputsq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Source Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputSQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
          
                for(var iter = 0; iter < $('#inputS').val(); iter++){
				$("#inputSQ"+parseInt(iter + 1)).val(mvec[iter].number);
				}
            $('#mysq').modal();
        }

    });
    $('.dq').on('click', function() {
        if (schemeChoose === '') {
            alert('Please choose the scheme!');
        } else if (schemeChoose === 'self-defined') {
            if (!$('#inputD').val()) {
                alert('Please input Demand Quantity');
                return;
            }
            $('#mydq .modal-body').empty();
            for (var i = 0; i < $('#inputD').val(); i++) {
                $('#mydq .modal-body').append(' <div class="form-group inputdq">' +
                    '<label for="inputdq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Demand Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputDQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
            $('#mydq').modal();
        } else {
            var s = schemeChoose.split('-');
            $('#mydq .modal-body').empty();
            for (var i = 0; i < s[1]; i++) {
                $('#mydq .modal-body').append(' <div class="form-group inputdq">' +
                    '<label for="inputdq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Demand Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputDQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
            for(var iter = 0; iter < $('#inputD').val(); iter++){
				$("#inputDQ"+parseInt(iter + 1)).val(nvec[iter].number);
				}
            $('#mydq').modal();
        }
    });
    $('.tq').on('click', function() {
        if (schemeChoose === '') {
            alert('Please choose the scheme!');
        } else if (schemeChoose === 'self-defined') {
            if (!$('#inputT').val()) {
                alert('Please input Truck Quantity');
                return;
            }
            $('#mytq .modal-body').empty();
            for (var i = 0; i < $('#inputT').val(); i++) {
                $('#mytq .modal-body').append(' <div class="form-group inputtq">' +
                    '<label for="inputtq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Truck Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputTQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
            $('#mytq').modal();
        } else {
            var s = schemeChoose.split('-');
            $('#mytq .modal-body').empty();
            for (var i = 0; i < s[2]; i++) {
                $('#mytq .modal-body').append(' <div class="form-group inputtq">' +
                    '<label for="inputtq" class="col-lg-4 col-md-4 col-sm-4 col-xs-4 control-label sq-label">Truck Quantity ' + parseInt(i + 1) + '</label>' +
                    '<div class="col-lg-4 col-md-4 col-sm-4 col-xs-4 input-group">' +
                    '<input type="number" class="form-control form-width" id="inputTQ' + parseInt(i + 1) + '">' +
                    '</div>' +
                    '</div>');
            }
           for(var iter = 0; iter < $('#inputT').val(); iter++){
				$("#inputTQ"+parseInt(iter + 1)).val(truckvec[iter].capacity);
			}
            $('#mytq').modal();
        }
    });

    $('.navigation1 li').on('click', function() {
        var this_id = $(this).attr('id');
        $(".step-one,.step-two,.step-three").css('display', 'none');
        $("." + this_id).css('display', 'block');
    });

    $('.next-step').on('click', function() {
        $(this).parent().css('display', 'none');
        $(this).parent().next().css('display', 'block');
        $("#step-one").removeClass("active");
        $("#step-two").addClass("active");

    });

    $('.next-step2').on('click', function() {
        jsonroot = jQuery.parseJSON(jsonstr);
        minit2();

        $(this).parent().css('display', 'none');
        $(this).parent().next().css('display', 'block');
        $("#step-two").removeClass("active");
        $("#step-three").addClass("active");
        $("#remove-down").removeClass("slide-container-down");
        $(".downslide").removeClass("downslide-up");
    });

    $('#step-one').on('click', function() {
        $("#remove-down").addClass("slide-container-down");
        $(".downslide").addClass("downslide-up");
        ctx.clearRect(0, 0, width, height);
        bshow = false;
    });

    $('#step-two').on('click', function() {
        $("#remove-down").addClass("slide-container-down");
        $(".downslide").addClass("downslide-up");
    });

    $('#step-three').on('click', function() {
        $("#remove-down").removeClass("slide-container-down");
        $(".downslide").removeClass("downslide-up");
        setTimeout(function() {
            $("#remove-down").addClass("slide-container-down");
            $(".downslide").addClass("downslide-up");
        }, 10000);

    });
    
	//generate
    $(".generate").click(function() {
        if (bselfdefine) {

            snum = $("#inputS").val();
            dnum = $("#inputD").val();
            tnum = $("#inputT").val();
            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];
            for (var iter = 0; iter < snum; iter++) {
                mvec[iter] = mcity.make(mpos.make(mrand(10, 601), mrand(10, 601)), "m", mrand(1, 11));
            }
            for (var iter = 0; iter < dnum; iter++) {
                nvec[iter] = mcity.make(mpos.make(mrand(10, 601), mrand(10, 601)), "n", mrand(1, 6));
            }
            for (var iter = 0; iter < tnum; iter++) {
                truckvec[iter] = mtruck.make(mpos.make(mrand(10, 601), mrand(10, 601)), 2);
            }

            dataobj = {
                sourcelist: [],
                targetlist: [],
                trucklist: []
            };
            for (var iter = 0; iter < snum; iter++) {
                dataobj.sourcelist.push({ x: mvec[iter].pos.posx, y: mvec[iter].pos.posy, num: mvec[iter].number });
            }
            for (var iter = 0; iter < dnum; iter++) {
                dataobj.targetlist.push({ x: nvec[iter].pos.posx, y: nvec[iter].pos.posy, num: nvec[iter].number });
            }
            for (var iter = 0; iter < tnum; iter++) {
                dataobj.trucklist.push({ x: truckvec[iter].pos.posx, y: truckvec[iter].pos.posy, capacity: truckvec[iter].capacity })
            }
            inputjsonstr = JSON.stringify(dataobj);
            minit();
            bshow = true;
        } else {
            minit();
            bshow = true;
        }

    });
    setInterval(function() {
        mainloop();
    }, 20);
});

//特殊函数 路径更新函数
function updatestate(vtruckid) {
    if (stateindexvec[vtruckid] == pathstrvec[vtruckid].length) {
        // 这里勾变绿色
        $('.state .check').eq(vtruckid).find(".icon-check").addClass("icon-check-green");

    } else {
        $('.state .carname').eq(vtruckid).nextAll('.block').eq(stateindexvec[vtruckid] + 1).addClass("visited");
        $('.state .carname').eq(vtruckid).nextAll('.block').eq(stateindexvec[vtruckid]).removeClass("visited");
        stateindexvec[vtruckid]++;
    }
}

//函数 void() 画车出发地
function drawinits() {
    for (var iter = 0; iter < initposvec.length; iter++) {
        ctx.fillStyle = "#FFFF37";
        ctx.beginPath();
        ctx.arc(initposvec[iter].posx, initposvec[iter].posy, Rplace, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();
    }
}

//函数 void() 画供应城市
function drawstarts() {
    for (var iter = 0; iter < mvec.length; iter++) {
        var tx = mvec[iter].pos.posx;
        var ty = mvec[iter].pos.posy;

        if (mvec[iter].number > 0) {
            ctx.fillStyle = "#00AA00";
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "green";
            ctx.stroke();
            ctx.closePath();
        }

        ctx.font = "15px SimHei";
        ctx.fillStyle = "black";
        var wordposx = tx - 30;
        var wordposy = ty + 20;
        if (wordposx >= maxboardx) { wordposx = maxboardx; } else if (wordposx <= minboard) { wordposx = minboard; }
        if (wordposy >= maxboardy) { wordposy = maxboardy; } else if (wordposy <= minboard) { wordposy = minboard; }
        ctx.fillText('S' + String(iter + 1) + ':' + mvec[iter].number, wordposx, wordposy);
    }
}

//函数 void() 画需求城市
function drawends() {
    for (var iter = 0; iter < nvec.length; iter++) {
        var tx = nvec[iter].pos.posx;
        var ty = nvec[iter].pos.posy;

        if (nvec[iter].number == 0) {
            //满足，画实心红圆
            ctx.fillStyle = "#FF0000";
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        } else if (nvec[iter].number == endsorinumvec[iter]) {
            //还没有东西运进来过，空圆
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "red";
            ctx.stroke();
            ctx.closePath();
        } 
		else if(nvec[iter].number<0){
			//过度满足，红圆中心画绿
			//画红外圆环
			ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "red";
            ctx.stroke();
			
			//画内绿圆
			 ctx.fillStyle = "#00AA00";
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace-2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
			
			ctx.closePath();
		}
		else {
            //半圆
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, 0, Math.PI * 2, true);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "red";
            ctx.stroke();
            ctx.closePath();

            ctx.fillStyle = "#FF0000";
            ctx.beginPath();
            ctx.arc(tx, ty, Rplace, Math.PI, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        }

        ctx.font = "15px SimHei";
        ctx.fillStyle = "black";
        var wordposx = tx - 30;
        var wordposy = ty + 20;
        if (wordposx >= maxboardx) { wordposx = maxboardx; } else if (wordposx <= minboard) { wordposx = minboard; }
        if (wordposy >= maxboardy) { wordposy = maxboardy; } else if (wordposy <= minboard) { wordposy = minboard; }
        ctx.fillText('D' + String(iter + 1) + ':' + nvec[iter].number, wordposx, wordposy);
    }
}

//函数 void() 画车
function drawtrucks() {
    for (var iter = 0; iter < tnum; iter++) {
        var tcarx = missionvec[iter].thistruck;
        if (tcarx.nowload > 0) {
            ctx.fillStyle = "#0000ff";
            ctx.beginPath();
            ctx.arc(tcarx.pos.posx, tcarx.pos.posy, Rcar, 0, Math.PI * 2, true);
            ctx.fillText('T' + String(iter + 1), tcarx.pos.posx - Rcar * 1.5, tcarx.pos.posy + Rcar * 3.5);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(tcarx.pos.posx, tcarx.pos.posy, Rcar, 0, Math.PI * 2, true);
            ctx.fillText('T' + String(iter + 1), tcarx.pos.posx - Rcar * 1.5, tcarx.pos.posy + Rcar * 3.5);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "blue";
            ctx.stroke();
            ctx.closePath();
        }
    }
}

//函数 画虚线
function drawDashLine(x1, y1, x2, y2, dashLength) {
    var dashLen = dashLength == undefined ? 5 : dashLength,
        xpos = x2 - x1, //得到横向的宽度;
        ypos = y2 - y1, //得到纵向的高度;
        numDashes = Math.floor(Math.sqrt(xpos * xpos + ypos * ypos) / dashLen);
    //利用正切获取斜边的长度除以虚线长度，得到要分为多少段;
    for (var i = 0; i < numDashes; i++) {
        if (i % 2 === 0) {
            ctx.moveTo(x1 + (xpos / numDashes) * i, y1 + (ypos / numDashes) * i);
            //有了横向宽度和多少段，得出每一段是多长，起点 + 每段长度 * i = 要绘制的起点；
        } else {
            ctx.lineTo(x1 + (xpos / numDashes) * i, y1 + (ypos / numDashes) * i);
        }
    }
    ctx.strokeStyle = "blue";
    ctx.stroke();
}

function showgrid() {
    ctx.clearRect(0, 0, width, height);
    //载入网格图片
    var img = new Image()
    img.src = "bg.png";
    ctx.drawImage(img, 0, 0);
}

//函数 void() 刷新画面
function updatescene() {
    ctx.clearRect(0, 0, width, height);
    //载入网格图片
    var img = new Image()
    img.src = "bg.png";
    ctx.drawImage(img, 0, 0);

    //画车出发地
    drawinits();
    //画供应城市
    drawstarts();
    //画需求城市
    drawends();
    //画车
    drawtrucks();


    //画drawroutevec中的虚线
    for (var iter = 0; iter < drawroutevec.length; iter++) {
        drawDashLine(
            drawroutevec[iter].startpos.posx,
            drawroutevec[iter].startpos.posy,
            drawroutevec[iter].endpos.posx,
            drawroutevec[iter].endpos.posy,
            8
        );
    }

    //画数字渐隐动画
    for (var iter = 0; iter < anivec.length; iter++) {
        if (anivec[iter].alpha <= 0) {} else {
            ctx.globalAlpha = anivec[iter].alpha;
            ctx.fillStyle = "black";
            ctx.beginPath();
            ctx.font = "30px Verdana";
            ctx.fillText(String(anivec[iter].changenum), anivec[iter].posx, anivec[iter].posy);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();

            //更改anivec[iter].alpha下次的值
            anivec[iter].alpha -= 0.005; //2s内隐去
        }
    }
    ctx.globalAlpha = 1;

    //结束模态框中的文字
    function replace(value) {
        document.getElementById('replacetxt').innerHTML = value;
    }
    replace("Over, " + pathlengthstr);


    if (bend) {
        $("#overmodal").modal();
        bend = false;
    }
    drawroutevec = [];
}


//函数 int(string)
function GetIndexOfDName(vdname) {
    return parseInt(vdname.substr(1, vdname.length - 1));
}

//函数 void() 开始后主循环
function startloop() {
    for (var iter = 0; iter < tnum; iter++) {
        var temmission = missionvec[iter];
        if (temmission.nowindex == 0 && !bfirstupdatevec[iter]) {
            bfirstupdatevec[iter] = true;
            updatestate(iter);
        }
        if (temmission.nowindex >= temmission.jobarr.length) {
            continue;
        }
        var temjob = temmission.jobarr[temmission.nowindex];
        temmission.bfinish = temmission.thistruck.mupdate(temjob);
        if (temjob.targetname != "null") {
            drawroutevec.push(mline.make(temjob.startpos, FindCityPos(temjob.targetname)));
        }
        if (temmission.bfinish == 1) {
            updatestate(iter);
            temmission.bfinish = 0;
            temmission.nowindex += 1;
            jobbfinished += 1;
            if (jobbfinished == totaljobnum) { //所有mjob对象已经完成
                bend = true;
                bstart = false;
            }
        }
    }
    updatescene();
}

//函数 void() 动画主循环
function mainloop() {
    if (!bstart) {
        if (bshow) {
            updatescene();
        } else {
            showgrid();
        }
    } else {
        startloop();
    }
}

function upload(input) {
    bstart = false;
    //支持chrome IE10
    if (window.FileReader) {
        var file = input.files[0];
        filename = file.name.split(".")[0];
        var reader = new FileReader();
        reader.onload =
            function() {
                console.log(this.result)
                jsonstr = this.result;
            };
        reader.readAsText(file);
    }
    //支持IE 7 8 9 10
    else if (typeof window.ActiveXObject != 'undefined') {
        var xmlDoc;
        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = false;
        xmlDoc.load(input.value);
        jsonstr = xmlDoc.xml;
    }
    //支持FF
    else if (document.implementation && document.implementation.createDocument) {
        var xmlDoc;
        xmlDoc = document.implementation.createDocument("", "", null);
        xmlDoc.async = false;
        xmlDoc.load(input.value);
        jsonstr = xmlDoc.xml;
    } else {
        alert('error');
    }
    alert("Submitted Successfully!");
    jsonroot = jQuery.parseJSON(jsonstr);
    $("#mymodal-upload").modal('hide');
}
