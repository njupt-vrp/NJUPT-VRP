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
                      "x":387,\
                      "y":94,\
                      "num":1\
                  },\
                  {\
                      "x":534,\
                      "y":314,\
                      "num":4\
                  },\
                  {\
                      "x":536,\
                      "y":371,\
                      "num":5\
                  },\
                  {\
                      "x":58,\
                      "y":582,\
                      "num":8\
                  },\
                  {\
                      "x":146,\
                      "y":421,\
                      "num":2\
                  }\
                  ],\
                  "targetlist":[\
                  {\
                      "x":179,\
                      "y":452,\
                      "num":2\
                  },\
                  {\
                      "x":366,\
                      "y":545,\
                      "num":3\
                  },\
                  {\
                      "x":115,\
                      "y":278,\
                      "num":2\
                  },\
                  {\
                      "x":229,\
                      "y":327,\
                      "num":1\
                  }\
                  ,\
                  {\
                      "x":317,\
                      "y":343,\
                      "num":5\
                  }\
                  ],\
                  "trucklist":[\
                  {\
                      "x":55,\
                      "y":404,\
                      "capacity":2\
                  },\
                  {\
                      "x":193,\
                      "y":165,\
                      "capacity":2\
                  },\
                  {\
                      "x":71,\
                      "y":213,\
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

            mvec[0] = mcity.make(mpos.make(387, 94), "m", 1);
            mvec[1] = mcity.make(mpos.make(534, 314), "m", 4);
            mvec[2] = mcity.make(mpos.make(536, 371), "m", 5);
            mvec[3] = mcity.make(mpos.make(55, 582), "m", 8);
            mvec[4] = mcity.make(mpos.make(146, 421), "m", 2);

            nvec[0] = mcity.make(mpos.make(179, 452), "n", 2);
            nvec[1] = mcity.make(mpos.make(366, 545), "n", 3);
            nvec[2] = mcity.make(mpos.make(115, 278), "n", 2);
            nvec[3] = mcity.make(mpos.make(229, 327), "n", 1);
            nvec[4] = mcity.make(mpos.make(317, 343), "n", 5);

            truckvec[0] = mtruck.make(mpos.make(55, 404), 2);
            truckvec[1] = mtruck.make(mpos.make(193, 165), 2);
            truckvec[2] = mtruck.make(mpos.make(71, 213), 2);

            document.getElementById("inputS").value = 5;
            document.getElementById("inputD").value = 5;
            document.getElementById("inputT").value = 3;
            
            
        } else if (schemeChoose == '8-8-4') {
            //确定内置动画
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
            //确定内置datajson
            inputjsonstr = '\
                  {\
                     "sourcelist":[ \
                     {\
                      "x":459,\
                      "y":349,\
                      "num":8\
                  },\
                  {\
                      "x":143,\
                      "y":145,\
                      "num":4\
                  },\
                  {\
                      "x":542,\
                      "y":468,\
                      "num":6\
                  },\
                  {\
                      "x":171,\
                      "y":200,\
                      "num":2\
                  },\
                  {\
                      "x":102,\
                      "y":396,\
                      "num":4\
                  },\
                  {\
                      "x":389,\
                      "y":209,\
                      "num":1\
                  },\
                  {\
                      "x":573,\
                      "y":474,\
                      "num":1\
                  },\
                  {\
                      "x":54,\
                      "y":440,\
                      "num":5\
                  }\
                  ],\
                  "targetlist":[\
                  {\
                      "x":490,\
                      "y":20,\
                      "num":3\
                  },\
                  {\
                      "x":131,\
                      "y":106,\
                      "num":2\
                  },\
                  {\
                      "x":524,\
                      "y":505,\
                      "num":5\
                  },\
                  {\
                      "x":44,\
                      "y":382,\
                      "num":3\
                  },\
                  {\
                      "x":544,\
                      "y":186,\
                      "num":5\
                  },\
                  {\
                      "x":596,\
                      "y":99,\
                      "num":3\
                  },\
                  {\
                      "x":99,\
                      "y":456,\
                      "num":1\
                  }\
                  ,\
                  {\
                      "x":230,\
                      "y":480,\
                      "num":1\
                  }\
                  ],\
                  "trucklist":[\
                  {\
                      "x":571,\
                      "y":138,\
                      "capacity":2\
                  },\
                  {\
                      "x":359,\
                      "y":239,\
                      "capacity":2\
                  },\
                   {\
                      "x":411,\
                      "y":363,\
                      "capacity":2\
                  },\
                  {\
                      "x":584,\
                      "y":55,\
                      "capacity":2\
                  }\
                  ]\
                }';

            jsonroot = jQuery.parseJSON(jsonstr);

            snum = 8;
            dnum = 8;
            tnum = 4;

            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(459, 349), "m", 8);
            mvec[1] = mcity.make(mpos.make(143, 145), "m", 4);
            mvec[2] = mcity.make(mpos.make(542, 468), "m", 6);
            mvec[3] = mcity.make(mpos.make(171, 200), "m", 2);
            mvec[4] = mcity.make(mpos.make(102, 396), "m", 4);
            mvec[5] = mcity.make(mpos.make(389, 209), "m", 1);
            mvec[6] = mcity.make(mpos.make(573, 474), "m", 1);
            mvec[7] = mcity.make(mpos.make(54, 440), "m", 5);

            nvec[0] = mcity.make(mpos.make(490, 20), "n", 3);
            nvec[1] = mcity.make(mpos.make(131, 106), "n", 2);
            nvec[2] = mcity.make(mpos.make(524, 505), "n", 5);
            nvec[3] = mcity.make(mpos.make(44, 382), "n", 3);
            nvec[4] = mcity.make(mpos.make(544, 186), "n", 5);
            nvec[5] = mcity.make(mpos.make(596, 99), "n", 3);
            nvec[6] = mcity.make(mpos.make(99, 456), "n", 1);
            nvec[7] = mcity.make(mpos.make(230, 480), "n", 1);

            truckvec[0] = mtruck.make(mpos.make(571, 138), 2);
            truckvec[1] = mtruck.make(mpos.make(359, 239), 2);
            truckvec[2] = mtruck.make(mpos.make(411, 363), 2);
            truckvec[3] = mtruck.make(mpos.make(584, 55), 2);

            document.getElementById("inputS").value = 8;
            document.getElementById("inputD").value = 8;
            document.getElementById("inputT").value = 4;
            
            
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
                      "y":540,\
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
                      "y":540,\
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
                      "x":550,\
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
			
			mvec[5] = mcity.make(mpos.make(50, 540), "m", 7);
			mvec[6] = mcity.make(mpos.make(516, 114), "m", 9);
			mvec[7] = mcity.make(mpos.make(296, 84), "m", 8);
			mvec[8] = mcity.make(mpos.make(293, 261), "m", 4);
			mvec[9] = mcity.make(mpos.make(298, 382), "m", 5);

            nvec[0] = mcity.make(mpos.make(177, 480), "n", 3);
            nvec[1] = mcity.make(mpos.make(126, 116), "n", 1);
            nvec[2] = mcity.make(mpos.make(257, 199), "n", 4);
            nvec[3] = mcity.make(mpos.make(365, 540), "n", 5);
            nvec[4] = mcity.make(mpos.make(142, 19), "n", 3);
			
			nvec[5] = mcity.make(mpos.make(440, 279), "n", 3);
			nvec[6] = mcity.make(mpos.make(104, 400), "n", 5);
			nvec[7] = mcity.make(mpos.make(285, 383), "n", 2);
			nvec[8] = mcity.make(mpos.make(73, 23), "n", 1);
			nvec[9] = mcity.make(mpos.make(359, 309), "n", 5);

            truckvec[0] = mtruck.make(mpos.make(550, 287), 2);
            truckvec[1] = mtruck.make(mpos.make(446, 69), 2);
            truckvec[2] = mtruck.make(mpos.make(180, 244), 2);
			truckvec[3] = mtruck.make(mpos.make(361, 565), 2);
			truckvec[4] = mtruck.make(mpos.make(335, 346), 2);

        } else if (schemeChoose == '20-20-10') {
            

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
            
            inputjsonstr='\
            {\
            "sourcelist":[\
                     {\
                      "x":210,\
                      "y":427,\
                      "num":7\
                  },\
                  {\
                      "x":382,\
                      "y":182,\
                      "num":10\
                  },\
                  {\
                      "x":535,\
                      "y":51,\
                      "num":5\
                  },\
                  {\
                      "x":572,\
                      "y":420,\
                      "num":9\
                  },\
                  {\
                      "x":178,\
                      "y":530,\
                      "num":1\
                  },\
                  {\
                      "x":439,\
                      "y":145,\
                      "num":6\
                  },\
                  {\
                      "x":485,\
                      "y":49,\
                      "num":10\
                  },\
                  {\
                      "x":127,\
                      "y":80,\
                      "num":4\
                  },\
                  {\
                      "x":420,\
                      "y":128,\
                      "num":4\
                  },\
                  {\
                      "x":321,\
                      "y":152,\
                      "num":8\
                  },\
                  {\
                      "x":19,\
                      "y":393,\
                      "num":6\
                  },\
                  {\
                      "x":328,\
                      "y":184,\
                      "num":8\
                  },\
                  {\
                      "x":10,\
                      "y":298,\
                      "num":4\
                  },\
                  {\
                      "x":109,\
                      "y":167,\
                      "num":1\
                  },\
                  {\
                      "x":392,\
                      "y":377,\
                      "num":8\
                  },\
                  {\
                      "x":216,\
                      "y":496,\
                      "num":10\
                  },\
                  {\
                      "x":547,\
                      "y":450,\
                      "num":1\
                  },\
                  {\
                      "x":63,\
                      "y":289,\
                      "num":10\
                  },\
                  {\
                      "x":96,\
                      "y":451,\
                      "num":5\
                  },\
                  {\
                      "x":405,\
                      "y":332,\
                      "num":6\
                  }\
                  ],\
                  "targetlist":[\
                  {\
                      "x":490,\
                      "y":368,\
                      "num":4\
                  },\
                  {\
                      "x":507,\
                      "y":247,\
                      "num":4\
                  },\
                  {\
                      "x":551,\
                      "y":397,\
                      "num":3\
                  },\
                  {\
                      "x":339,\
                      "y":532,\
                      "num":1\
                  },\
                  {\
                      "x":143,\
                      "y":264,\
                      "num":2\
                  },\
                  {\
                      "x":113,\
                      "y":240,\
                      "num":4\
                  },\
                  {\
                      "x":447,\
                      "y":426,\
                      "num":3\
                  },\
                  {\
                      "x":118,\
                      "y":49,\
                      "num":1\
                  },\
                  {\
                      "x":286,\
                      "y":334,\
                      "num":4\
                  },\
                  {\
                      "x":495,\
                      "y":24,\
                      "num":4\
                  },\
                  {\
                      "x":257,\
                      "y":133,\
                      "num":5\
                  },\
                  {\
                      "x":14,\
                      "y":561,\
                      "num":1\
                  },\
                  {\
                      "x":147,\
                      "y":384,\
                      "num":1\
                  },\
                  {\
                      "x":63,\
                      "y":45,\
                      "num":1\
                  },\
                  {\
                      "x":182,\
                      "y":584,\
                      "num":4\
                  },\
                  {\
                      "x":431,\
                      "y":462,\
                      "num":2\
                  },\
                  {\
                      "x":541,\
                      "y":361,\
                      "num":1\
                  },\
                  {\
                      "x":176,\
                      "y":12,\
                      "num":5\
                  },\
                  {\
                      "x":18,\
                      "y":474,\
                      "num":1\
                  },\
                  {\
                      "x":597,\
                      "y":391,\
                      "num":4\
                  }\
                  ],\
                  "trucklist":[\
                  {\
                      "x":300,\
                      "y":317,\
                      "capacity":2\
                  },\
                   {\
                      "x":259,\
                      "y":208,\
                      "capacity":2\
                  },\
                   {\
                      "x":241,\
                      "y":78,\
                      "capacity":2\
                  },\
                   {\
                      "x":368,\
                      "y":139,\
                      "capacity":2\
                  },\
                   {\
                      "x":110,\
                      "y":40,\
                      "capacity":2\
                  },\
                   {\
                      "x":422,\
                      "y":434,\
                      "capacity":2\
                  },\
                  {\
                      "x":415,\
                      "y":369,\
                      "capacity":2\
                  },\
                  {\
                      "x":193,\
                      "y":234,\
                      "capacity":2\
                  },\
                  {\
                      "x":462,\
                      "y":42,\
                      "capacity":2\
                  },\
                  {\
                      "x":91,\
                      "y":396,\
                      "capacity":2\
                  }\
                  ]\
                }';
    
            jsonroot = jQuery.parseJSON(jsonstr);

            snum = 20;
            dnum = 20;
            tnum = 10;

            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(210, 427), "m", 7);
            mvec[1] = mcity.make(mpos.make(382, 182), "m", 10);
            mvec[2] = mcity.make(mpos.make(531, 51), "m", 5);
            mvec[3] = mcity.make(mpos.make(572, 420), "m", 9);
            mvec[4] = mcity.make(mpos.make(178, 530), "m", 1);
            
            mvec[5] = mcity.make(mpos.make(439, 145), "m", 6);
            mvec[6] = mcity.make(mpos.make(485, 49), "m", 10);
            mvec[7] = mcity.make(mpos.make(127, 80), "m", 4);
            mvec[8] = mcity.make(mpos.make(420, 128), "m", 4);
            mvec[9] = mcity.make(mpos.make(321, 152), "m", 8);
            
            mvec[10] = mcity.make(mpos.make(19, 393), "m", 6);
            mvec[11] = mcity.make(mpos.make(328, 184), "m", 8);
            mvec[12] = mcity.make(mpos.make(10, 298), "m", 4);
            mvec[13] = mcity.make(mpos.make(109, 167), "m", 1);
            mvec[14] = mcity.make(mpos.make(392, 377), "m", 8);
            
            mvec[15] = mcity.make(mpos.make(216, 496), "m", 10);
            mvec[16] = mcity.make(mpos.make(547, 450), "m", 1);
            mvec[17] = mcity.make(mpos.make(63, 289), "m", 10);
            mvec[18] = mcity.make(mpos.make(96, 451), "m", 5);
            mvec[19] = mcity.make(mpos.make(405, 332), "m", 6);

            nvec[0] = mcity.make(mpos.make(490, 368), "n", 4);
            nvec[1] = mcity.make(mpos.make(507, 247), "n", 4);
            nvec[2] = mcity.make(mpos.make(551, 397), "n", 3);
            nvec[3] = mcity.make(mpos.make(339, 532), "n", 1);
            nvec[4] = mcity.make(mpos.make(143, 264), "n", 2);
            
            nvec[5] = mcity.make(mpos.make(113, 240), "n", 4);
            nvec[6] = mcity.make(mpos.make(447, 426), "n", 3);
            nvec[7] = mcity.make(mpos.make(118, 49), "n", 1);
            nvec[8] = mcity.make(mpos.make(286, 334), "n", 4);
            nvec[9] = mcity.make(mpos.make(495, 24), "n", 4);
            
            nvec[10] = mcity.make(mpos.make(257, 133), "n", 5);
            nvec[11] = mcity.make(mpos.make(14, 561), "n", 1);
            nvec[12] = mcity.make(mpos.make(147, 384), "n", 1);
            nvec[13] = mcity.make(mpos.make(63, 45), "n", 1);
            nvec[14] = mcity.make(mpos.make(182, 584), "n", 4);
            
            nvec[15] = mcity.make(mpos.make(431, 462), "n", 2);
            nvec[16] = mcity.make(mpos.make(541, 361), "n", 1);
            nvec[17] = mcity.make(mpos.make(176, 12), "n", 5);
            nvec[18] = mcity.make(mpos.make(18, 474), "n", 1);
            nvec[19] = mcity.make(mpos.make(597, 391), "n", 4);

            truckvec[0] = mtruck.make(mpos.make(300, 317), 2);
            truckvec[1] = mtruck.make(mpos.make(259, 208), 2);
            truckvec[2] = mtruck.make(mpos.make(241, 78), 2);
            truckvec[3] = mtruck.make(mpos.make(368, 139), 2);
            truckvec[4] = mtruck.make(mpos.make(110, 40), 2);
            
            truckvec[5] = mtruck.make(mpos.make(422, 434), 2);
            truckvec[6] = mtruck.make(mpos.make(415, 369), 2);
            truckvec[7] = mtruck.make(mpos.make(193, 234), 2);
            truckvec[8] = mtruck.make(mpos.make(462, 42), 2);
            truckvec[9] = mtruck.make(mpos.make(91, 396), 2);
            document.getElementById("inputS").value = 20;
            document.getElementById("inputD").value = 20;
            document.getElementById("inputT").value = 10;
        } else if (schemeChoose == '25-25-15') {
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
            inputjsonstr =' {\
    "sourcelist": [\
        {\
            "x": 491,\
            "y": 109,\
            "num": 4\
        },\
        {\
            "x": 501,\
            "y": 488,\
            "num": 4\
        },\
        {\
            "x": 337,\
            "y": 356,\
            "num": 2\
        },\
        {\
            "x": 481,\
            "y": 61,\
            "num": 3\
        },\
        {\
            "x": 63,\
            "y": 142,\
            "num": 5\
        },\
        {\
            "x": 39,\
            "y": 363,\
            "num": 9\
        },\
        {\
            "x": 108,\
            "y": 376,\
            "num": 1\
        },\
        {\
            "x": 312,\
            "y": 250,\
            "num": 5\
        },\
        {\
            "x": 33,\
            "y": 555,\
            "num": 6\
        },\
        {\
            "x": 487,\
            "y": 294,\
            "num": 8\
        },\
        {\
            "x": 188,\
            "y": 557,\
            "num": 5\
        },\
        {\
            "x": 422,\
            "y": 64,\
            "num": 4\
        },\
        {\
            "x": 361,\
            "y": 527,\
            "num": 8\
        },\
        {\
            "x": 324,\
            "y": 285,\
            "num": 9\
        },\
        {\
            "x": 190,\
            "y": 173,\
            "num": 5\
        },\
        {\
            "x": 139,\
            "y": 211,\
            "num": 6\
        },\
        {\
            "x": 549,\
            "y": 28,\
            "num": 6\
        },\
        {\
            "x": 376,\
            "y": 272,\
            "num": 9\
        },\
        {\
            "x": 135,\
            "y": 104,\
            "num": 4\
        },\
        {\
            "x": 23,\
            "y": 231,\
            "num": 4\
        },\
        {\
            "x": 514,\
            "y": 178,\
            "num": 1\
        },\
        {\
            "x": 166,\
            "y": 575,\
            "num": 9\
        },\
        {\
            "x": 246,\
            "y": 585,\
            "num": 9\
        },\
        {\
            "x": 205,\
            "y": 420,\
            "num": 7\
        },\
        {\
            "x": 303,\
            "y": 229,\
            "num": 5\
        }\
    ],\
    "targetlist": [\
        {\
            "x": 217,\
            "y": 245,\
            "num": 2\
        },\
        {\
            "x": 93,\
            "y": 142,\
            "num": 1\
        },\
        {\
            "x": 527,\
            "y": 15,\
            "num": 2\
        },\
        {\
            "x": 488,\
            "y": 453,\
            "num": 4\
        },\
        {\
            "x": 21,\
            "y": 258,\
            "num": 3\
        },\
        {\
            "x": 244,\
            "y": 372,\
            "num": 1\
        },\
        {\
            "x": 279,\
            "y": 403,\
            "num": 1\
        },\
        {\
            "x": 537,\
            "y": 72,\
            "num": 5\
        },\
        {\
            "x": 208,\
            "y": 260,\
            "num": 2\
        },\
        {\
            "x": 84,\
            "y": 150,\
            "num": 3\
        },\
        {\
            "x": 246,\
            "y": 211,\
            "num": 4\
        },\
        {\
            "x": 527,\
            "y": 140,\
            "num": 4\
        },\
        {\
            "x": 335,\
            "y": 564,\
            "num": 3\
        },\
        {\
            "x": 191,\
            "y": 216,\
            "num": 3\
        },\
        {\
            "x": 297,\
            "y": 533,\
            "num": 5\
        },\
        {\
            "x": 460,\
            "y": 443,\
            "num": 4\
        },\
        {\
            "x": 586,\
            "y": 355,\
            "num": 2\
        },\
        {\
            "x": 314,\
            "y": 340,\
            "num": 1\
        },\
        {\
            "x": 188,\
            "y": 440,\
            "num": 1\
        },\
        {\
            "x": 208,\
            "y": 582,\
            "num": 2\
        },\
        {\
            "x": 594,\
            "y": 199,\
            "num": 3\
        },\
        {\
            "x": 585,\
            "y": 132,\
            "num": 4\
        },\
        {\
            "x": 415,\
            "y": 403,\
            "num": 5\
        },\
        {\
            "x": 500,\
            "y": 117,\
            "num": 1\
        },\
        {\
            "x": 274,\
            "y": 290,\
            "num": 5\
        }\
    ],\
    "trucklist": [\
        {\
            "x": 270,\
            "y": 164,\
            "capacity": 2\
        },\
        {\
            "x": 189,\
            "y": 324,\
            "capacity": 2\
        },\
        {\
            "x": 16,\
            "y": 572,\
            "capacity": 2\
        },\
        {\
            "x": 39,\
            "y": 437,\
            "capacity": 2\
        },\
        {\
            "x": 522,\
            "y": 453,\
            "capacity": 2\
        },\
        {\
            "x": 139,\
            "y": 381,\
            "capacity": 2\
        },\
        {\
            "x": 125,\
            "y": 534,\
            "capacity": 2\
        },\
        {\
            "x": 394,\
            "y": 550,\
            "capacity": 2\
        },\
        {\
            "x": 364,\
            "y": 484,\
            "capacity": 2\
        },\
        {\
            "x": 335,\
            "y": 394,\
            "capacity": 2\
        },\
        {\
            "x": 359,\
            "y": 480,\
            "capacity": 2\
        },\
        {\
            "x": 183,\
            "y": 268,\
            "capacity": 2\
        },\
        {\
            "x": 402,\
            "y": 525,\
            "capacity": 2\
        },\
        {\
            "x": 433,\
            "y": 10,\
            "capacity": 2\
        },\
        {\
            "x": 157,\
            "y": 265,\
            "capacity": 2\
        }\
    ]\
}';
            jsonroot = jQuery.parseJSON(jsonstr);
            snum = 25;
            dnum = 25;
            tnum = 15;
            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

            mvec[0] = mcity.make(mpos.make(491,109), "m", 4);
            mvec[1] = mcity.make(mpos.make(501,488), "m", 4);
            mvec[2] = mcity.make(mpos.make(337,356), "m", 2);
            mvec[3] = mcity.make(mpos.make(481,61), "m", 3);
            mvec[4] = mcity.make(mpos.make(63,142), "m", 5);
            mvec[5] = mcity.make(mpos.make(39,363), "m", 9);
            mvec[6] = mcity.make(mpos.make(108,376), "m", 1);
            mvec[7] = mcity.make(mpos.make(312,250), "m", 5);
            mvec[8] = mcity.make(mpos.make(33, 555), "m", 6);
            mvec[9] = mcity.make(mpos.make(487, 294), "m", 8);
            mvec[10] = mcity.make(mpos.make(188, 557), "m", 5);
            mvec[11] = mcity.make(mpos.make(422, 64), "m", 4);
            mvec[12] = mcity.make(mpos.make(361, 527), "m", 8);
            mvec[13] = mcity.make(mpos.make(324,285), "m", 9);
            mvec[14] = mcity.make(mpos.make(190, 173), "m", 5);
            mvec[15] = mcity.make(mpos.make(139,211), "m",6);
            mvec[16] = mcity.make(mpos.make(549,28), "m", 6);
            mvec[17] = mcity.make(mpos.make(376,272), "m",9);
            mvec[18] = mcity.make(mpos.make(135,104), "m", 4);
            mvec[19] = mcity.make(mpos.make(23, 231), "m", 4);
            mvec[20] = mcity.make(mpos.make(514, 178), "m",1);
            mvec[21] = mcity.make(mpos.make(166,575), "m", 9);
            mvec[22] = mcity.make(mpos.make(246, 585), "m", 9);
            mvec[23] = mcity.make(mpos.make(205,420), "m",7);
            mvec[24] = mcity.make(mpos.make(303,229), "m",5);
            
            nvec[0] = mcity.make(mpos.make(217,245), "n", 2);
            nvec[1] = mcity.make(mpos.make(93, 142), "n", 1);
            nvec[2] = mcity.make(mpos.make(527,15), "n",2)
            nvec[3] = mcity.make(mpos.make(488,453), "n",4)
            nvec[4] = mcity.make(mpos.make(21,258), "n",3)
            nvec[5] = mcity.make(mpos.make(244,372), "n",1)
            nvec[6] = mcity.make(mpos.make(279,403), "n", 1)
            nvec[7] = mcity.make(mpos.make(537,72), "n",5)
            nvec[8] = mcity.make(mpos.make(208, 260), "n",2)
            nvec[9] = mcity.make(mpos.make(84,150), "n",3)
            nvec[10] = mcity.make(mpos.make(246, 211), "n",4)
            nvec[11] = mcity.make(mpos.make(527,140), "n",4)
            nvec[12] = mcity.make(mpos.make(335,564), "n",3)
            nvec[13] = mcity.make(mpos.make(191, 216), "n",3)
            nvec[14] = mcity.make(mpos.make(297,533), "n",5)
            nvec[15] = mcity.make(mpos.make(460,443), "n",4)
            nvec[16] = mcity.make(mpos.make(586,355), "n", 2)
            nvec[17] = mcity.make(mpos.make(314, 340), "n", 1)
            nvec[18] = mcity.make(mpos.make(188, 440), "n", 1)
            nvec[19] = mcity.make(mpos.make(208,582), "n", 2)
            nvec[20] = mcity.make(mpos.make(594, 199), "n",3)
            nvec[21] = mcity.make(mpos.make(585, 132), "n",4)
            nvec[22] = mcity.make(mpos.make(415, 403), "n",5)
            nvec[23] = mcity.make(mpos.make(500, 117), "n", 1)
            nvec[24] = mcity.make(mpos.make(274, 290), "n", 5)
            
            truckvec[0] = mtruck.make(mpos.make(270,164), 2);
            truckvec[1] = mtruck.make(mpos.make(189, 324), 2);
            truckvec[2] = mtruck.make(mpos.make(16, 572), 2);
            truckvec[3] = mtruck.make(mpos.make(39, 437), 2);
            truckvec[4] = mtruck.make(mpos.make(522, 453), 2);
            truckvec[5] = mtruck.make(mpos.make(139, 381), 2);
            truckvec[6] = mtruck.make(mpos.make(125, 534), 2);
            truckvec[7] = mtruck.make(mpos.make(394,550), 2);
            truckvec[8] = mtruck.make(mpos.make(364, 484), 2);
            truckvec[9] = mtruck.make(mpos.make(335, 394), 2);
            truckvec[10] = mtruck.make(mpos.make(359, 480), 2);
            truckvec[11] = mtruck.make(mpos.make(183,268), 2);
            truckvec[12] = mtruck.make(mpos.make(402, 525), 2);
            truckvec[13] = mtruck.make(mpos.make(433, 10), 2);
            truckvec[14] = mtruck.make(mpos.make(157, 265), 2);

            document.getElementById("inputS").value = 25;
            document.getElementById("inputD").value = 25;
            document.getElementById("inputT").value = 15;
        } else if (schemeChoose == '30-30-20') {
            //确定内置动画
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
            //确定内置datajson
            inputjsonstr = '{\
    "sourcelist": [\
        {\
            "x": 61,\
            "y": 303,\
            "num": 2\
        },\
        {\
            "x": 205,\
            "y": 504,\
            "num": 7\
        },\
        {\
            "x": 79,\
            "y": 114,\
            "num": 4\
        },\
        {\
            "x": 496,\
            "y": 526,\
            "num": 9\
        },\
        {\
            "x": 49,\
            "y": 172,\
            "num": 5\
        },\
        {\
            "x": 540,\
            "y": 144,\
            "num": 6\
        },\
        {\
            "x": 298,\
            "y": 28,\
            "num": 9\
        },\
        {\
            "x": 233,\
            "y": 153,\
            "num": 6\
        },\
        {\
            "x": 491,\
            "y": 429,\
            "num": 4\
        },\
        {\
            "x": 132,\
            "y": 100,\
            "num": 8\
        },\
        {\
            "x": 574,\
            "y": 239,\
            "num": 8\
        },\
        {\
            "x": 379,\
            "y": 559,\
            "num": 1\
        },\
        {\
            "x": 501,\
            "y": 586,\
            "num": 2\
        },\
        {\
            "x": 575,\
            "y": 389,\
            "num": 3\
        },\
        {\
            "x": 451,\
            "y": 167,\
            "num": 2\
        },\
        {\
            "x": 477,\
            "y": 12,\
            "num": 3\
        },\
        {\
            "x": 171,\
            "y": 71,\
            "num": 1\
        },\
        {\
            "x": 423,\
            "y": 449,\
            "num": 3\
        },\
        {\
            "x": 120,\
            "y": 52,\
            "num": 1\
        },\
        {\
            "x": 61,\
            "y": 181,\
            "num": 7\
        },\
        {\
            "x": 394,\
            "y": 276,\
            "num": 4\
        },\
        {\
            "x": 424,\
            "y": 199,\
            "num": 7\
        },\
        {\
            "x": 489,\
            "y": 403,\
            "num": 1\
        },\
        {\
            "x": 505,\
            "y": 310,\
            "num": 4\
        },\
        {\
            "x": 35,\
            "y": 113,\
            "num": 2\
        },\
        {\
            "x": 561,\
            "y": 506,\
            "num": 9\
        },\
        {\
            "x": 174,\
            "y": 95,\
            "num": 9\
        },\
        {\
            "x": 250,\
            "y": 138,\
            "num": 4\
        },\
        {\
            "x": 372,\
            "y": 345,\
            "num": 6\
        },\
        {\
            "x": 137,\
            "y": 295,\
            "num": 5\
        }\
    ],\
    "targetlist": [\
        {\
            "x": 524,\
            "y": 37,\
            "num": 5\
        },\
        {\
            "x": 265,\
            "y": 294,\
            "num": 4\
        },\
        {\
            "x": 423,\
            "y": 434,\
            "num": 2\
        },\
        {\
            "x": 317,\
            "y": 36,\
            "num": 4\
        },\
        {\
            "x": 51,\
            "y": 142,\
            "num": 5\
        },\
        {\
            "x": 251,\
            "y": 330,\
            "num": 4\
        },\
        {\
            "x": 183,\
            "y": 360,\
            "num": 5\
        },\
        {\
            "x": 499,\
            "y": 395,\
            "num": 3\
        },\
        {\
            "x": 69,\
            "y": 176,\
            "num": 1\
        },\
        {\
            "x": 492,\
            "y": 556,\
            "num": 3\
        },\
        {\
            "x": 219,\
            "y": 162,\
            "num": 4\
        },\
        {\
            "x": 564,\
            "y": 20,\
            "num": 1\
        },\
        {\
            "x": 193,\
            "y": 351,\
            "num": 3\
        },\
        {\
            "x": 442,\
            "y": 594,\
            "num": 4\
        },\
        {\
            "x": 12,\
            "y": 573,\
            "num": 3\
        },\
        {\
            "x": 243,\
            "y": 561,\
            "num": 2\
        },\
        {\
            "x": 171,\
            "y": 506,\
            "num": 1\
        },\
        {\
            "x": 111,\
            "y": 444,\
            "num": 3\
        },\
        {\
            "x": 455,\
            "y": 459,\
            "num": 3\
        },\
        {\
            "x": 564,\
            "y": 449,\
            "num": 5\
        },\
        {\
            "x": 349,\
            "y": 365,\
            "num": 2\
        },\
        {\
            "x": 41,\
            "y": 133,\
            "num": 4\
        },\
        {\
            "x": 154,\
            "y": 555,\
            "num": 2\
        },\
        {\
            "x": 411,\
            "y": 147,\
            "num": 2\
        },\
        {\
            "x": 319,\
            "y": 147,\
            "num": 3\
        },\
        {\
            "x": 363,\
            "y": 77,\
            "num": 4\
        },\
        {\
            "x": 547,\
            "y": 72,\
            "num": 5\
        },\
        {\
            "x": 260,\
            "y": 88,\
            "num": 3\
        },\
        {\
            "x": 489,\
            "y": 251,\
            "num": 2\
        },\
        {\
            "x": 279,\
            "y": 452,\
            "num": 3\
        }\
    ],\
    "trucklist": [\
        {\
            "x": 174,\
            "y": 80,\
            "capacity": 2\
        },\
        {\
            "x": 305,\
            "y": 158,\
            "capacity": 2\
        },\
        {\
            "x": 245,\
            "y": 581,\
            "capacity": 2\
        },\
        {\
            "x": 279,\
            "y": 457,\
            "capacity": 2\
        },\
        {\
            "x": 235,\
            "y": 550,\
            "capacity": 2\
        },\
        {\
            "x": 160,\
            "y": 173,\
            "capacity": 2\
        },\
        {\
            "x": 363,\
            "y": 352,\
            "capacity": 2\
        },\
        {\
            "x": 428,\
            "y": 271,\
            "capacity": 2\
        },\
        {\
            "x": 274,\
            "y": 291,\
            "capacity": 2\
        },\
        {\
            "x": 349,\
            "y": 302,\
            "capacity": 2\
        },\
        {\
            "x": 421,\
            "y": 306,\
            "capacity": 2\
        },\
        {\
            "x": 21,\
            "y": 469,\
            "capacity": 2\
        },\
        {\
            "x": 332,\
            "y": 285,\
            "capacity": 2\
        },\
        {\
            "x": 499,\
            "y": 298,\
            "capacity": 2\
        },\
        {\
            "x": 240,\
            "y": 200,\
            "capacity": 2\
        },\
        {\
            "x": 182,\
            "y": 51,\
            "capacity": 2\
        },\
        {\
            "x": 276,\
            "y": 577,\
            "capacity": 2\
        },\
        {\
            "x": 283,\
            "y": 222,\
            "capacity": 2\
        },\
        {\
            "x": 153,\
            "y": 211,\
            "capacity": 2\
        },\
        {\
            "x": 588,\
            "y": 118,\
            "capacity": 2\
        }\
    ]\
}';

            jsonroot = jQuery.parseJSON(jsonstr);

            snum = 30;
            dnum = 30;
            tnum = 20;

            //初始化部分全局变量
            mvec = [];
            nvec = [];
            truckvec = [];

mvec[0]=mcity.make(mpos.make(61,303),"m",2);
mvec[1]=mcity.make(mpos.make(205,504),"m",7);
mvec[2]=mcity.make(mpos.make(79,114),"m",4);
mvec[3]=mcity.make(mpos.make(496,526),"m",9);
mvec[4]=mcity.make(mpos.make(49,172),"m",5);
mvec[5]=mcity.make(mpos.make(540,144),"m",6);
mvec[6]=mcity.make(mpos.make(298,28),"m",9);
mvec[7]=mcity.make(mpos.make(233,153),"m",6);
mvec[8]=mcity.make(mpos.make(491,429),"m",4);
mvec[9]=mcity.make(mpos.make(132,100),"m",8);
mvec[10]=mcity.make(mpos.make(574,239),"m",8);
mvec[11]=mcity.make(mpos.make(379,559),"m",1);
mvec[12]=mcity.make(mpos.make(501,586),"m",2);
mvec[13]=mcity.make(mpos.make(575,389),"m",3);
mvec[14]=mcity.make(mpos.make(451,167),"m",2);
mvec[15]=mcity.make(mpos.make(477,12),"m",3);
mvec[16]=mcity.make(mpos.make(171,71),"m",1);
mvec[17]=mcity.make(mpos.make(423,449),"m",3);
mvec[18]=mcity.make(mpos.make(120,52),"m",1);
mvec[19]=mcity.make(mpos.make(61,181),"m",7);
mvec[20]=mcity.make(mpos.make(394,276),"m",4);
mvec[21]=mcity.make(mpos.make(424,199),"m",7);
mvec[22]=mcity.make(mpos.make(489,403),"m",1);
mvec[23]=mcity.make(mpos.make(505,310),"m",4);
mvec[24]=mcity.make(mpos.make(35,113),"m",2);
mvec[25]=mcity.make(mpos.make(561,506),"m",9);
mvec[26]=mcity.make(mpos.make(174,95),"m",9);
mvec[27]=mcity.make(mpos.make(250,138),"m",4);
mvec[28]=mcity.make(mpos.make(372,345),"m",6);
mvec[29]=mcity.make(mpos.make(137,295),"m",5);
nvec[0]=mcity.make(mpos.make(524,37),"n",5);
nvec[1]=mcity.make(mpos.make(265,294),"n",4);
nvec[2]=mcity.make(mpos.make(423,434),"n",2);
nvec[3]=mcity.make(mpos.make(317,36),"n",4);
nvec[4]=mcity.make(mpos.make(51,142),"n",5);
nvec[5]=mcity.make(mpos.make(251,330),"n",4);
nvec[6]=mcity.make(mpos.make(183,360),"n",5);
nvec[7]=mcity.make(mpos.make(499,395),"n",3);
nvec[8]=mcity.make(mpos.make(69,176),"n",1);
nvec[9]=mcity.make(mpos.make(492,556),"n",3);
nvec[10]=mcity.make(mpos.make(219,162),"n",4);
nvec[11]=mcity.make(mpos.make(564,20),"n",1);
nvec[12]=mcity.make(mpos.make(193,351),"n",3);
nvec[13]=mcity.make(mpos.make(442,594),"n",4);
nvec[14]=mcity.make(mpos.make(12,573),"n",3);
nvec[15]=mcity.make(mpos.make(243,561),"n",2);
nvec[16]=mcity.make(mpos.make(171,506),"n",1);
nvec[17]=mcity.make(mpos.make(111,444),"n",3);
nvec[18]=mcity.make(mpos.make(455,459),"n",3);
nvec[19]=mcity.make(mpos.make(564,449),"n",5);
nvec[20]=mcity.make(mpos.make(349,365),"n",2);
nvec[21]=mcity.make(mpos.make(41,133),"n",4);
nvec[22]=mcity.make(mpos.make(154,555),"n",2);
nvec[23]=mcity.make(mpos.make(411,147),"n",2);
nvec[24]=mcity.make(mpos.make(319,147),"n",3);
nvec[25]=mcity.make(mpos.make(363,77),"n",4);
nvec[26]=mcity.make(mpos.make(547,72),"n",5);
nvec[27]=mcity.make(mpos.make(260,88),"n",3);
nvec[28]=mcity.make(mpos.make(489,251),"n",2);
nvec[29]=mcity.make(mpos.make(279,452),"n",3);
truckvec[0]=mtruck.make(mpos.make(174,80),2);
truckvec[1]=mtruck.make(mpos.make(305,158),2);
truckvec[2]=mtruck.make(mpos.make(245,581),2);
truckvec[3]=mtruck.make(mpos.make(279,457),2);
truckvec[4]=mtruck.make(mpos.make(235,550),2);
truckvec[5]=mtruck.make(mpos.make(160,173),2);
truckvec[6]=mtruck.make(mpos.make(363,352),2);
truckvec[7]=mtruck.make(mpos.make(428,271),2);
truckvec[8]=mtruck.make(mpos.make(274,291),2);
truckvec[9]=mtruck.make(mpos.make(349,302),2);
truckvec[10]=mtruck.make(mpos.make(421,306),2);
truckvec[11]=mtruck.make(mpos.make(21,469),2);
truckvec[12]=mtruck.make(mpos.make(332,285),2);
truckvec[13]=mtruck.make(mpos.make(499,298),2);
truckvec[14]=mtruck.make(mpos.make(240,200),2);
truckvec[15]=mtruck.make(mpos.make(182,51),2);
truckvec[16]=mtruck.make(mpos.make(276,577),2);
truckvec[17]=mtruck.make(mpos.make(283,222),2);
truckvec[18]=mtruck.make(mpos.make(153,211),2);
truckvec[19]=mtruck.make(mpos.make(588,118),2);


            document.getElementById("inputS").value = 30;
            document.getElementById("inputD").value = 30;
            document.getElementById("inputT").value = 20;
            
            
        } else {
            bselfdefine = true;
            schemeChoose = 'self-defined';
        }
    });

	$("#source-quantity").click(function() {
		alert("ok");
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
			for(var iter = 0; iter < $('#inputS').val(); iter++){
				$("#inputSQ"+parseInt(iter + 1)).val(mvec[iter].number);
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
			for(var iter = 0; iter < $('#inputD').val(); iter++){
				$("#inputDQ"+parseInt(iter + 1)).val(nvec[iter].number);
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
			for(var iter = 0; iter < $('#inputT').val(); iter++){
				$("#inputTQ"+parseInt(iter + 1)).val(truckvec[iter].capacity);
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
        $(this).parent().css('display', 'none');
        $(this).parent().next().css('display', 'block');
        $("#step-two").removeClass("active");
        $("#step-three").addClass("active");
        $("#remove-down").removeClass("slide-container-down");
        $(".downslide").removeClass("downslide-up");	
    });

    if($("#step-three").attr("class") == "active") {
        $("#remove-down").removeClass("slide-container-down");
        $(".downslide").removeClass("downslide-up");
    }

    $('.email-name').on('click', function() {
        var emailtime = $("#input-time").val();

        var emailaddress = $("#input-email").val();

        var blob = new Blob([inputjsonstr], {
            type: "text/plain;charset=utf-8"
        });

    tchoose=$('input:radio:checked').val();
    inputs=$('#inputS').val();
    inputd=$('#inputD').val();
    inputt=$('#inputT').val();
        if(tchoose=="genetic"){
	var datakind1 = inputs + " " + inputd + " " +inputt;
        $.ajax({
                type: "POST",
                url: "geneticjson",
                data: {
                jsonstr_:inputjsonstr,
		data1:datakind1,
                time_:emailtime,
		email_:emailaddress,
                },
                dataType: "json",
            success: function(data) {
            if (data['status'] == 'error') {
                alert('error');
            }else {
                jsonstr=data['geneticmsg'];
	//	anchorname=data['refmsg'];
                jsonroot = jQuery.parseJSON(jsonstr);
                    minit2();
	//	location.hash=anchorname;
            }
                },
           });
    }
    if(tchoose=="clustering"){
	var datakind2 = inputs + " " + inputd + " " +inputt;
        $.ajax({
                type: "POST",
                url: "clusteringjson",
                data: {
                jsonstr_:inputjsonstr,
		data2:datakind2,
                time_:emailtime,
		email_:emailaddress,
                },
                dataType: "json",
            success: function(data) {
            if (data['status'] == 'error') {
                alert('error');
            }else {
                jsonstr=data['clusteringmsg'];
	//	anchorname=data['refmsg'];
                jsonroot = jQuery.parseJSON(jsonstr);
                    minit2();
	//	location.hash=anchorname;
            }
                },
           });
    }
    if(tchoose=="ant"){
	var datakind3 = inputs + " " + inputd + " " +inputt;
        $.ajax({
                type: "POST",
                url: "antjson",
                data: {
                jsonstr_:inputjsonstr,
                data3:datakind3,
                time_:emailtime,
		email_:emailaddress,
                },
                dataType: "json",
            success: function(data) {
            if (data['status'] == 'error') {
                alert('error');
            }else {
                jsonstr=data['antmsg'];
          //      anchorname=data['refmsg'];
                jsonroot = jQuery.parseJSON(jsonstr);
                    minit2();
            //    location.hash=anchorname;
            }
                },
           });
    }
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
    img.src = "vrp/static/images/bg.png";
    ctx.drawImage(img, 0, 0);
}

//函数 void() 刷新画面
function updatescene() {
    ctx.clearRect(0, 0, width, height);
    //载入网格图片
    var img = new Image()
    img.src = "vrp/static/images/bg.png";
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

