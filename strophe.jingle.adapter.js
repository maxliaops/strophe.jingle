/* jshint -W117 */
function TraceablePeerConnection(ice_config, constraints) {
    var self = this;
    var RTCPeerconnection = webkitRTCPeerConnection || mozRTCPeerConnection;
    this.peerconnection = new RTCPeerconnection(ice_config, constraints);
    this.updateLog = [];

    // override as desired
    this.trace = function(what, info) {
        //console.warn('WTRACE', what, info);
        self.updateLog.push({
            time: new Date(),
            type: what,
            value: info
        });
    };
    this.onicecandidate = null;
    this.peerconnection.onicecandidate = function (event) {
        if (self.onicecandidate !== null) {
            self.onicecandidate(event);
        }
    };
    this.onaddstream = null;
    this.peerconnection.onaddstream = function (event) {
        if (self.onaddstream !== null) {
            self.onaddstream(event);
        }
    };
    this.onremovestream = null;
    this.peerconnection.onremovestream = function (event) {
        if (self.onremovestream !== null) {
            self.onremovestream(event);
        }
    };
    this.onsignalingstatechange = null;
    this.peerconnection.onsignalingstatechange = function (event) {
        if (self.onsignalingstatechange !== null) {
            self.onsignalingstatechange(event);
        }
    };
};

TraceablePeerConnection.prototype.__defineGetter__('signalingState', function() { return this.peerconnection.signalingState; });
TraceablePeerConnection.prototype.__defineGetter__('iceConnectionState', function() { return this.peerconnection.iceConnectionState; });
TraceablePeerConnection.prototype.__defineGetter__('localDescription', function() { return this.peerconnection.localDescription; });
TraceablePeerConnection.prototype.__defineGetter__('remoteDescription', function() { return this.peerconnection.remoteDescription; });

TraceablePeerConnection.prototype.addStream = function (stream) {
    this.trace('addStream', stream);
    this.peerconnection.addStream(stream);
};

TraceablePeerConnection.prototype.removeStream = function (stream) {
    this.trace('removeStream', stream);
    this.peerconnection.removeStream(stream);
};

TraceablePeerConnection.prototype.setLocalDescription = function (description, successCallback, failureCallback) {
    var self = this;
    this.trace('setLocalDescription', description);
    this.peerconnection.setLocalDescription(description, 
        function () {
            self.trace('setLocalDescriptionOnSuccess');
            successCallback();
        },
        function (err) {
            self.trace('setLocalDescriptionOnFailure', err);
            failureCallback(err);
        }
    );
};

TraceablePeerConnection.prototype.setRemoteDescription = function (description, successCallback, failureCallback) {
    var self = this;
    this.trace('setRemoteDescription', description);
    this.peerconnection.setRemoteDescription(description, 
        function () {
            self.trace('setRemoteDescriptionOnSuccess');
            successCallback();
        },
        function (err) {
            self.trace('setRemoteDescriptionOnFailure', err);
            failureCallback(err);
        }
    );
};

TraceablePeerConnection.prototype.close = function () {
    this.trace('stop');
    this.peerconnection.close();
};

TraceablePeerConnection.prototype.createOffer = function (successCallback, failureCallback, constraints) {
    var self = this;
    this.trace('createOffer', constraints);
    this.peerconnection.createOffer(
        function (sdp) {
            self.trace('createOfferOnSuccess', sdp);
            successCallback(sdp);
        },
        function(err) {
            self.trace('createOfferOnFailure', err);
            failureCallback(err);
        },
        constraints
    );
};

TraceablePeerConnection.prototype.createAnswer = function (successCallback, failureCallback, constraints) {
    var self = this;
    this.trace('createAnswer', constraints);
    this.peerconnection.createAnswer(
        function (sdp) {
            self.trace('createAnswerOnSuccess', sdp);
            successCallback(sdp);
        },
        function(err) {
            self.trace('createAnswerOnFailure', err);
            failureCallback(err);
        },
        constraints
    );
};

TraceablePeerConnection.prototype.addIceCandidate = function (candidate, successCallback, failureCallback) {
    var self = this;
    this.trace('addIceCandidate', candidate);
    this.peerconnection.addIceCandidate(candidate);
    /* maybe later
    this.peerconnection.addIceCandidate(candidate, 
        function () {                                
            self.trace('addIceCandidateOnSuccess');
            successCallback();
        },
        function (err) {
            self.trace('addIceCandidateOnFailure', err);
            failureCallback(err);
        }
    );
    */
};

TraceablePeerConnection.prototype.getStats = function(callback) {
    this.peerconnection.getStats(callback);
};


// mozilla chrome compat layer -- very similar to adapter.js
function setupRTC() {
    var RTC = null;
    if (navigator.mozGetUserMedia) {
        console.log('This appears to be Firefox');
        var version = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
        if (version >= 22) {
            RTC = {
                peerconnection: mozRTCPeerConnection,
                browser: 'firefox',
                getUserMedia: navigator.mozGetUserMedia.bind(navigator),
                attachMediaStream: function (element, stream) {
                    element[0].mozSrcObject = stream;
                    element[0].play();
                },
                pc_constraints: {}
            };
            if (!MediaStream.prototype.getVideoTracks)
                MediaStream.prototype.getVideoTracks = function () { return []; };
            if (!MediaStream.prototype.getAudioTracks)
                MediaStream.prototype.getAudioTracks = function () { return []; };
            RTCSessionDescription = mozRTCSessionDescription;
            RTCIceCandidate = mozRTCIceCandidate;
        }
    } else if (navigator.webkitGetUserMedia) {
        console.log('This appears to be Chrome');
        RTC = {
            peerconnection: webkitRTCPeerConnection,
            browser: 'chrome',
            getUserMedia: navigator.webkitGetUserMedia.bind(navigator),
            attachMediaStream: function (element, stream) {
                element.attr('src', webkitURL.createObjectURL(stream));
            },
//            pc_constraints: {} // FIVE-182
            pc_constraints: {'optional': [{'DtlsSrtpKeyAgreement': 'true'}]} // enable dtls support in canary
        };
        if (navigator.userAgent.indexOf('Android') != -1) {
            RTC.pc_constraints = {}; // disable DTLS on Android
        }
        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function () {
                return this.videoTracks;
            };
        }
        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function () {
                return this.audioTracks;
            };
        }
    }
    if (RTC === null) {
        try { console.log('Browser does not appear to be WebRTC-capable'); } catch (e) { }
    }
    return RTC;
}

function getUserMediaWithConstraints(um, resolution, bandwidth, fps) {
    var constraints = {audio: false, video: false};

    if (um.indexOf('video') >= 0) {
        constraints.video = {mandatory: {}};// same behaviour as true
    }
    if (um.indexOf('audio') >= 0) {
        constraints.audio = {};// same behaviour as true
    }
    if (um.indexOf('screen') >= 0) {
        constraints.video = {
            "mandatory": {
                "chromeMediaSource": "screen"
            }
        };
    }

    if (resolution && !constraints.video) {
        constraints.video = {mandatory: {}};// same behaviour as true
    }
    // see https://code.google.com/p/chromium/issues/detail?id=143631#c9 for list of supported resolutions
    switch (resolution) {
    // 16:9 first
    case '1080':
    case 'fullhd':
        constraints.video.mandatory.minWidth = 1920;
        constraints.video.mandatory.minHeight = 1080;
        constraints.video.mandatory.minAspectRatio = 1.77;
        break;
    case '720':
    case 'hd':
        constraints.video.mandatory.minWidth = 1280;
        constraints.video.mandatory.minHeight = 720;
        constraints.video.mandatory.minAspectRatio = 1.77;
        break;
    case '360':
        constraints.video.mandatory.minWidth = 640;
        constraints.video.mandatory.minHeight = 360;
        constraints.video.mandatory.minAspectRatio = 1.77;
        break;
    case '180':
        constraints.video.mandatory.minWidth = 320;
        constraints.video.mandatory.minHeight = 180;
        constraints.video.mandatory.minAspectRatio = 1.77;
        break;
        // 4:3
    case '960':
        constraints.video.mandatory.minWidth = 960;
        constraints.video.mandatory.minHeight = 720;
        break;
    case '640':
    case 'vga':
        constraints.video.mandatory.minWidth = 640;
        constraints.video.mandatory.minHeight = 480;
        break;
    case '320':
        constraints.video.mandatory.minWidth = 320;
        constraints.video.mandatory.minHeight = 240;
        break;
    default:
        if (navigator.userAgent.indexOf('Android') != -1) {
            constraints.video.mandatory.minWidth = 320;
            constraints.video.mandatory.minHeight = 240;
            constraints.video.mandatory.maxFrameRate = 15;
        }
        break;
    }

    if (bandwidth) { // doesn't work currently, see webrtc issue 1846
        if (!constraints.video) constraints.video = {mandatory: {}};//same behaviour as true
        constraints.video.optional = [{bandwidth: bandwidth}];
    }
    if (fps) { // for some cameras it might be necessary to request 30fps
        // so they choose 30fps mjpg over 10fps yuy2
        if (!constraints.video) constraints.video = {mandatory: {}};// same behaviour as tru;
        constraints.video.mandatory.minFrameRate = fps;
    }
 
    try {
        RTC.getUserMedia(constraints,
                function (stream) {
                    console.log('onUserMediaSuccess');
                    $(document).trigger('mediaready.jingle', [stream]);
                },
                function (error) {
                    console.warn('Failed to get access to local media. Error ', error);
                    $(document).trigger('mediafailure.jingle');
                });
    } catch (e) {
        console.error('GUM failed: ', e);
        $(document).trigger('mediafailure.jingle');
    }
}
