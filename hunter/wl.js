var userInfo = JSON.parse(localStorage.getItem('userInfo'));

const streamStates = {
    MAIN_PRESENTER: 'MainPresenter',
    PRESENTATION: 'Presentation',
    CO_HOST_PRESENTER: 'CoHostPresenter'
}

const connectionStates = {
    ONLINE: 'Online',
    OFFLINE: 'Offline'
}

const vidyoConnectionState = {
    DISCONNECTED: 'Disconnected',
    ESTABLISHING_CONNECTION: 'EstablishingConnection',
    CONNECTED: 'Connected',
    CONNECTION_LOST: 'ConnectionLost' // This state means that we have to attemp to auto-connect again if we know that internet connection was restored.
}

const EMeetingStatus = Object.freeze({ "New": 1, "Started": 2, "Completed": 3, "Canceled": 4, "Paused": 5 });

class CoHostPresenter {
    constructor(participant) {
        this.participant = participant;
        this.camera = null;
        this.microphone = null;
    }
    GetID() {
        return this.participant.userId;
    }
}

var vdoPlugin = vdoPlugin || {
    settings: {},
    renderId: 'renderer0',
    renderShareId: 'renderer1',
    cameras: [],
    coHostPresenters: [],
    windowShares: [],
    selectedSpeaker: false,
    activeStreamState: streamStates.MAIN_PRESENTER,
    connectionState: connectionStates.ONLINE, // This is internet connection state.
    vidyoConnectorState: vidyoConnectionState.DISCONNECTED,
    isMeetingPaused: false,
    selectedCoHostID: '' // This variable will store last selected Co-Host Presenter's ID so we can know when remote camera is added if we have to switch to it on not.
},
    configParams = configParams || {
        webrtcLogLevel: "none",
        remoteCameraDisplayCropped: true
    },
    vdoConnector;

vdoPlugin.setSetting = () => {
    vdoPlugin.settings = {
        // resourceId: helpers.localStorage.get('resourceId'),
        userName: "WL",
        hostName: "forum360.platform.vidyo.io",
        //token: helpers.localStorage.get('vidyoToken'),
        producerName: 'Main Presenter',
        // durationSession: helpers.localStorage.get('durationSession'),
        roomKey: '',
        roomPin: ''
    };
};
vdoPlugin.CreateVidyoConnector = function (VC) {
    VC.CreateVidyoConnector({
        viewId: null, //'videoRender', // Div ID where the composited video will be rendered, see VidyoConnector.html;
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 1, // Maximum number of participants to render
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
        logFileName: "VidyoConnector.log",
        userData: 0,
        constraints: {
            disableGoogleAnalytics: true,
            location: false,
            mediaConstraints: {
                audio: false,
                video: false
            }
        }
    }).then(function (vc) {
        vdoPlugin.vdoConnector = vc;
        vdoPlugin.setSetting();
        vdoPlugin.registerEvents(vdoPlugin.vdoConnector);
        // Populate the connectionStatus with the client version
        vidyoConnector.GetVersion().then(function (version) {
            console.log("v " + version);
        }).catch(function () {
            console.error("GetVersion failed");
        });
        vdoPlugin.autoJoinMeeting();
    })
        .catch(function (err) {
            console.error("CreateVidyoConnector Failed " + err);
        });
};

vdoPlugin.registerEvents = (vdoConnector) => {
    vdoPlugin.selectedSpeaker = false;
    vdoPlugin.registerDeviceListeners(vdoConnector);
    vdoPlugin.regiserModerationListeners(vdoConnector);
    vdoPlugin.handleParticipantChange(vdoConnector);
    vdoPlugin.handleRemoteSharing(vdoConnector);
    vdoConnector.SetAdvancedConfiguration({ disableStats: true });
};

vdoPlugin.switchToPresenterCamera = function () {
    if (vdoPlugin.streamerCamera) {
        vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer0');
        vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.streamerCamera);
    }
}

vdoPlugin.swithToCoHostCamera = function (participantID) {
    if (participantID) {
        var arrayLength = vdoPlugin.coHostPresenters.length;
        for (var i = 0; i < arrayLength; i++) {
            var ID = vdoPlugin.coHostPresenters[i].GetID();
            if (ID == participantID) {
                vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer0');
                vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.coHostPresenters[i].camera);
                break;
            }
        }
    }
}

vdoPlugin.switchToPresenterShare = () => {
    if (vdoPlugin.remoteWindowShare) {
        vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer0');
        setTimeout(() => {
            vdoPlugin.vdoConnector.AssignViewToRemoteWindowShare({
                viewId: 'renderer0',
                remoteWindowShare: vdoPlugin.remoteWindowShare,
                displayCropped: false,
                allowZoom: true
            }).then(function (retValue) {
                console.log("Document stream")
            }).catch(function () {
                console.log("AssignViewToRemoteWindowShare Failed");
            });
        }, 500);
    }
}

vdoPlugin.showStreamerCamera = function (vdoConnector, camera) {
    setTimeout(() => {
        vdoConnector.AssignViewToRemoteCamera({
            viewId: 'renderer0',
            remoteCamera: camera,
            displayCropped: true,
            allowZoom: false
        }).then(function (retValue) {
            console.log("Stream loaded")
        }).catch(function () {
            console.log("AssignViewToRemoteCamera Failed");
        });
    }, 500);
};

vdoPlugin.handleParticipantChange = (vdoConnector) => {
    vdoConnector.RegisterParticipantEventListener({
        onJoined: function (participant) {
            if (participant.name == vdoPlugin.settings.producerName) {
                // If Main Presenter has been disconnected from this meeting.
                if (vdoPlugin.userUsageInterval) { // Clearing it to not have more than one timer running to call the same function.
                    clearInterval(vdoPlugin.userUsageInterval);
                }
                // This call start periodic function call to tell server that this WL user is still online.
                vdoPlugin.initUserUsage();
            } else {
                vdoPlugin.coHostPresenters.push(new CoHostPresenter(participant));
            }
            vdoPlugin.add(participant);
        },
        onLeft: function (participant) {
            if (participant.name == vdoPlugin.settings.producerName) {
                // This call stops periodic function call to tell server that this WL user is still online.
                vdoPlugin.removeUserUsage();
            } else {
                //// Searching for just left participant in our list of Co-Host Presenters and removing this Presenter from the list.
                var arrayLength = vdoPlugin.coHostPresenters.length;
                for (var i = 0; i < arrayLength; i++) {
                    var ID = vdoPlugin.coHostPresenters[i].GetID();
                    if (ID == participant.userId) {
                        vdoPlugin.coHostPresenters.splice(i, 1);
                        break;
                    }
                }
                ////
            }
            vdoPlugin.remove(participant);
        },
        onDynamicChanged: function (participants, cameras) { },
        onLoudestChanged: function (participant, audioOnly) { }
    }).then(function () {
        console.log("RegisterParticipantEventListener Success");
    }).catch(function () {
        console.err("RegisterParticipantEventListener Failed");
    });
}

vdoPlugin.regiserModerationListeners = (vdoConnector) => {
    vdoConnector.RegisterModerationCommandEventListener({
        onModerationCommandReceived: (deviceType, moderationType, state) => {
            console.log(`Moderation command received: deviceType: ${deviceType}, moderationType: ${moderationType}, state: ${state}`);
        }
    });
}

vdoPlugin.registerDeviceListeners = (vdoConnector) => {
    vdoConnector.RegisterLocalCameraEventListener({
        onAdded: function (localCamera) {
            vdoConnector.SelectLocalCamera({ localCamera: null });
        },
        onRemoved: function (localCamera) { },
        onSelected: function (localCamera) { },
        onStateUpdated: function (localCamera, state) { }
    }).then(function () {
        console.log("RegisterLocalCameraEventListener Success");
    }).catch(function () {
        console.error("RegisterLocalCameraEventListener Failed");
    });

    // Handle appearance and disappearance of microphone devices in the system
    vdoConnector.RegisterLocalMicrophoneEventListener({
        onAdded: function (localMicrophone) {
            vdoConnector.SelectLocalMicrophone({ localMicrophone: null });
        },
        onRemoved: function (localMicrophone) { },
        onSelected: function (localMicrophone) { },
        onStateUpdated: function (localMicrophone, state) { }
    }).then(function () {
        console.log("RegisterLocalMicrophoneEventListener Success");
        vdoConnector.SetMicrophonePrivacy({ privacy: true });
    }).catch(function () {
        console.error("RegisterLocalMicrophoneEventListener Failed");
    });

      // Handle appearance and disappearance of speaker devices in the system
    vdoConnector.RegisterLocalSpeakerEventListener({
        onAdded: function (localSpeaker) {
            // New speaker is available
            $("#speakers").append("<option value='" + window.btoa(localSpeaker.id) + "'>" + localSpeaker.name + "</option>");
            speakers[window.btoa(localSpeaker.id)] = localSpeaker;
        },
        onRemoved: function (localSpeaker) {
            // Existing speaker became unavailable
            $("#speakers option[value='" + window.btoa(localSpeaker.id) + "']").remove();
            delete speakers[window.btoa(localSpeaker.id)];
         },
        onSelected: function (localSpeaker) {
            // Speaker was selected/unselected by you or automatically
            if (localSpeaker)
            $("#speakers option[value='" + window.btoa(localSpeaker.id) + "']").prop('selected', true);
         },
        onStateUpdated: function (localSpeaker, state) { }
    }).then(function () {
        console.log("RegisterLocalSpeakerEventListener Success");
    }).catch(function () {
        console.error("RegisterLocalSpeakerEventListener Failed");
    });

    vdoConnector.RegisterRemoteCameraEventListener({
        onAdded: function (camera, participant) {
            if (participant.name === vdoPlugin.settings.producerName) {
                vdoPlugin.cameras.push(camera.objId);
                vdoPlugin.streamerCamera = camera;
                // if (vdoPlugin.meeting.SessionStatus !== EMeetingStatus.Paused) {
                //     vdoPlugin.showStreamerCamera(vdoConnector, camera);
                // } else {
                //     vdoPlugin.hideViewRenderer(vdoConnector, 'renderer');
                // }
            }
            else {
                //// Searching for this participant in our list of Co-Host Presenters to add camera object to CoHostPresenter.
                var arrayLength = vdoPlugin.coHostPresenters.length;
                for (var i = 0; i < arrayLength; i++) {
                    var ID = vdoPlugin.coHostPresenters[i].GetID();
                    if (ID == participant.userId) {
                        vdoPlugin.coHostPresenters[i].camera = camera;
                        // Show added camera only if we have a Co-Host Presenter is currently on Active Stream and it's ID coincides with selected Co-Host Presenter which is on Active Stream now.
                        // if (vdoPlugin.activeStreamState == streamStates.CO_HOST_PRESENTER && vdoPlugin.selectedCoHostID == ID) {
                        //     if (vdoPlugin.meeting.SessionStatus !== EMeetingStatus.Paused) {
                        //         vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.coHostPresenters[i].camera);
                        //     }
                        // }
                        break;
                    }
                }
                ////
            }
        },
        onRemoved: function (camera, participant) {
            if (participant.name === vdoPlugin.settings.producerName) {
                _.remove(vdoPlugin.cameras, function (objId) {
                    return camera.objId == objId;
                });
                if (_.isEmpty(vdoPlugin.cameras)) {
                    vdoPlugin.hideViewRenderer(vdoConnector, 'renderer0');
                }
            }
            else {
                //// Searching for this participant in our list of Co-Host Presenters to remove camera object from CoHostPresenter object.
                var arrayLength = vdoPlugin.coHostPresenters.length;
                for (var i = 0; i < arrayLength; i++) {
                    var ID = vdoPlugin.coHostPresenters[i].GetID();
                    if (ID == participant.userId) {
                        vdoPlugin.coHostPresenters[i].camera = null;
                        // If camera of currently selected for Active Stream Co-Host Presenter gets removed then we have to hide 'renderer' so meeting background image will be visible.
                        // if (vdoPlugin.selectedCoHostID == ID) {
                        //     vdoPlugin.hideViewRenderer(vdoConnector, 'renderer');
                        // }
                        break;
                    }
                }
                ////
            }
        },
        onStateUpdated: function (camera, participant, state) { }
    }).then(function () {
        console.log("RegisterRemoteCameraEventListener Success");
    }).catch(function () {
        console.error("RegisterRemoteCameraEventListener Failed");
    });
}

vdoPlugin.handleRemoteSharing = (vdoConnector) => {
    vdoConnector.RegisterRemoteWindowShareEventListener({
        onAdded: function (remoteWindowShare, participant) {
            /* New window is available for sharing. */
            if (participant.name === vdoPlugin.settings.producerName) {
                vdoPlugin.windowShares.push(remoteWindowShare.objId);
                vdoPlugin.remoteWindowShare = remoteWindowShare;
                vdoPlugin.add(participant, "Share");
            }
        },
        onRemoved: function (remoteWindowShare, participant) {
            /* Existing window is no longer available for sharing */
            if (participant.name === vdoPlugin.settings.producerName) {
                _.remove(vdoPlugin.windowShares, function (objId) {
                    return objId == remoteWindowShare.objId;
                });

                if (_.isEmpty(vdoPlugin.windowShares)) {
                    delete (vdoPlugin.remoteWindowShare);
                }
                vdoPlugin.remove(participant, "Share")

            }
        },
        onStateUpdated: function (remoteWindowShare, state) {
            // remoteWindowShare state was updated
        }
    }).then(function () {
        console.log("RegisterRemoteWindowShareEventListener Success");
    }).catch(function () {
        console.error("RegisterRemoteWindowShareEventListener Failed");
    });
}

vdoPlugin.autoJoinMeeting = () => {
    vdoPlugin.settings.roomKey = "FZiArmRyvD";
    vdoPlugin.settings.roomPin = "1234567";
    vdoPlugin.startCall(vdoPlugin.vdoConnector);

};

vdoPlugin.hideViewRenderer = function (vdoConnector, renderId) {
    return vdoConnector.HideView({
        viewId: renderId
    });
};

vdoPlugin.add = (participant, doc = "") => {
    var button = document.createElement("button");
    button.id = participant.userId + doc;
    button.type = 'button';
    button.innerHTML = participant.name + " " + doc;
    button.onclick = () => {
        if (participant.name === vdoPlugin.settings.producerName) {
            if (doc)
                vdoPlugin.switchToPresenterShare();
            else
                vdoPlugin.switchToPresenterCamera();
        } else {
            vdoPlugin.swithToCoHostCamera(participant.userId);
        }

    };

    var loc = document.getElementById("hosts");
    loc.appendChild(button);
}

vdoPlugin.remove = (participant, doc = "") => {
    document.getElementById(participant.userId + doc).remove();
}


vdoPlugin.userUsage = function () {
    console.log("Log usage")
}

vdoPlugin.initUserUsage = function () {
    console.log("vdoPlugin.initUserUsage");
    // producer joined
    vdoPlugin.userUsage();
    vdoPlugin.userUsageInterval = setInterval(vdoPlugin.userUsage, 30000);
};

vdoPlugin.removeUserUsage = function () {
    console.log("vdoPlugin.removeUserUsage");
    delete (vdoPlugin.userUsageId);
    if (vdoPlugin.userUsageInterval)
        clearInterval(vdoPlugin.userUsageInterval);

    return Promise.resolve();
};

vdoPlugin.startCall = (vdoConnector) => {
    console.log("START CALL");
    vdoPlugin.vidyoConnectorState = vidyoConnectionState.ESTABLISHING_CONNECTION;
    //vdoConnector.Connect({
    vdoConnector.ConnectToRoomAsGuest({
        // Take input from options form
        host: vdoPlugin.settings.hostName,
        roomKey: vdoPlugin.settings.roomKey,
        displayName: "WL",
        roomPin: vdoPlugin.settings.roomPin,

        // Define handlers for connection events.
        onSuccess: function (reason) {
            console.log("vidyoConnector.Connect : onSuccess callback received", reason, "displayName = ", vdoPlugin.settings.userName);
            console.log('meeting.call.joined');
            vdoPlugin.vidyoConnectorState = vidyoConnectionState.CONNECTED;
        },
        onFailure: function (reason) {
            // Failed
            console.error("vidyoConnector.Connect : onFailure callback received");
        },
        onDisconnected: function (reason) {
            // Disconnected
            console.log("vidyoConnector.Connect : onDisconnected callback received", reason);
            vidyoConnector.SelectLocalCamera({ localCamera: null });
            vidyoConnector.SelectLocalMicrophone({ localMicrophone: null });
            vidyoConnector.SelectLocalSpeaker({ localSpeaker: null });
            vidyoConnector.Disable();
            vidyoConnector.Destruct();
            vdoPlugin.vidyoConnectorState = vidyoConnectionState.DISCONNECTED;

            console.log("vidyoConnector.Connect : onDisconnected cleanup completed.");
        }
    }).then(function (status) {
        vdoPlugin.isCalling = status;
        if (status) {
            console.log("*****************");
            console.log("Version: V3.1c");
            console.log("Comment: added audio constraints = false | enabled logging");
            console.log("Connect Success");
        } else {
            console.error("Connect Failed");
        }
    }).catch(function (err) {
        console.error("Connect Failed");
    });
};

function onVidyoLoaded(status) {
    console.log(`Status: ${status.state} Description: ${status.description}`);
    if (status.state == 'READY') {
        window.VC = new window.VidyoClientLib.VidyoClient('', () => {
            // After the VidyoClient is successfully initialized a global VC object will become available
            vdoPlugin.CreateVidyoConnector(window.VC);
        });
    }
};

vdoPlugin.loadVdoLib = function () {

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '../latest_build//VidyoClient.js';
    script.onload = function () {
        window.onVidyoLoaded({ state: 'READY', description: 'Native XMPP + WebRTC' });
    };
    document.getElementsByTagName('head')[0].appendChild(script);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = '../latest_build//VidyoClient.css';
    document.getElementsByTagName('head')[0].appendChild(style);
};

vdoPlugin.events = function () {
    //vdoPlugin.fullscreenEvents();
};

vdoPlugin.initialize = function (event) {
    // $(document).on('click touchmove', '#join-meeting', function () {
    //     //if (!vdoPlugin.meeting.VimeoOnly) {
    //     vdoPlugin.loadVdoLib();
    //     //}
    // });
    vdoPlugin.loadVdoLib();
    vdoPlugin.events();
    // Hook up speaker selector functions for each of the available speakers
    $("#speakers").change(function () {
        // Speaker selected from the drop-down menu
        $("#speakers option:selected").each(function () {
            speaker = speakers[$(this).val()];
            vdoPlugin.vdoConnector.SelectLocalSpeaker({
                localSpeaker: speaker
            }).then(function () {
                console.log("SelectSpeaker Success");
            }).catch(function () {
                console.error("SelectSpeaker Failed");
            });
        });
    });
};

$(function () {
    $("#helper").addClass("hidden");
    vdoPlugin.initialize();
});