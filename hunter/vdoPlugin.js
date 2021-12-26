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

const EMeetingStatus = Object.freeze ({ "New":1, "Started":2, "Completed":3, "Canceled":4, "Paused":5 });

var vdoPlugin = vdoPlugin || {
    settings: {},
    renderId: 'renderer',
    renderShareId: 'rendererShare',
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

vdoPlugin.setSetting = function () {
    vdoPlugin.settings = {
        resourceId: helpers.localStorage.get('resourceId'),
        userName: helpers.localStorage.get('token').userKey,
        hostName: "forum360.platform.vidyo.io",
        token: helpers.localStorage.get('vidyoToken'),
        producerName: 'Main Presenter',
        durationSession: helpers.localStorage.get('durationSession'),
        roomKey: '',
        roomPin: ''
    };
    if (!_.isNull(vdoPlugin.settings.token)) {
        vdoPlugin.loadVdoLib();
    }
};

window.onresize = function () {
    if (vdoConnector) {
        vdoPlugin.showViewRenderer(vdoConnector, 'renderer');
    }

    vdoPlugin.keepRenderRatio();
};

vdoPlugin.hideViewRenderer = function (vdoConnector, renderId) {
    //console.log(vdoConnector, renderId);
    return vdoConnector.HideView({
        viewId: renderId
    });
};

vdoPlugin.showViewRenderer = function (vdoConnector, renderId) {
    BookSession.UpdateActiveStreamFromDB();
    var render = document.getElementById(renderId);
    // From doc: "ShowViewAt - Sets the position of the view every time it's changed on the screen."
    Promise.resolve(vdoConnector.ShowViewAt({
        viewId: renderId,
        x: 0,
        y: 0,
        width: render.offsetWidth,
        height: render.offsetHeight
    })).then(function (result) {
        if (result) {
            vdoPlugin.vdoConnector.ShowAudioMeters({ viewId: renderId, showMeters: false });
            vdoPlugin.vdoConnector.ShowViewLabel({ viewId: renderId, showLabel: false });
        }
    });
};

vdoPlugin.showStreamerCamera = function (vdoConnector, camera) {
    setTimeout(() => {
        vdoConnector.AssignViewToRemoteCamera({
            viewId: 'renderer',
            remoteCamera: camera,
            displayCropped: true,
            allowZoom: false
        }).then(function (retValue) {
            //// This code doesn't work and seems never worked. The call to BookSession.checkMeetingStatus returns 'undefined', not the expected number result.
            //if (BookSession.checkMeetingStatus(vdoPlugin.meeting.SessionId) == 2) {
            //    vdoPlugin.showViewRenderer(vdoConnector, 'renderer');
            //}
            ////
        }).catch(function () {
            console.log("AssignViewToRemoteCamera Failed");
        });
    }, 500);
};

vdoPlugin.showRemoteWindowShare = function (vdoConnector, remoteWindowShare) {
    if (remoteWindowShare) {
        setTimeout(() => {
            vdoConnector.AssignViewToRemoteWindowShare({
                viewId: "rendererShare",
                remoteWindowShare: remoteWindowShare,
                displayCropped: false,
                allowZoom: true
            }).then(function (retValue) {
                BookSession.UpdateActiveStreamFromDB();
                if (!vdoPlugin.isMeetingPaused) {
                    vdoPlugin.showViewRenderer(vdoConnector, 'rendererShare');
                }
            }).catch(function () {
                console.log("AssignViewToRemoteWindowShare Failed");
            });
        }, 500);
    }
};

vdoPlugin.reconnectAttempt = function () {
    if (_.isUndefined(vdoPlugin.reconnectAttempts)) {
        vdoPlugin.reconnectAttempts = 5;
    }

    if (vdoPlugin.reconnectAttempts > 1) {
        vdoPlugin.reconnectAttempts--;
    } else {
        vdoPlugin.removeUserUsage().then(function () {
            $('#join-meeting').removeAttr('style').removeClass('render-spinner');
        });
    }
};

vdoPlugin.userUsage = function () {

    window.hideSpinner = true;

    //console.log("Ivan test, WL user 'still connected' event (userUsage), USER ID: " + vdoPlugin.userUsageId);

    if (_.isUndefined(vdoPlugin.userUsageId)) { //POST
        Services.postUserUsage({
            SessionId: vdoPlugin.meeting.SessionId
        })
            .then(function (res) {
                vdoPlugin.userUsageId = res.Payload.Id;
            }, vdoPlugin.reconnectAttempt);
    } else {
        Services.putUserUsage({
            Id: vdoPlugin.userUsageId
        })
            .then(function (res) {
                // console.log(res);
            }, vdoPlugin.reconnectAttempt);
    }
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

//vdoPlugin.checkSessionAlive = function () {

//    /*
//    if ( _.isUndefined(vdoPlugin.sessionAliveAttempts)) {
//        vdoPlugin.sessionAliveAttempts = 10;
//        $('#join-meeting').removeAttr('style').removeClass('render-spinner').addClass('render-retrying');
//    }
//    */

//    if (_.isUndefined(vdoPlugin.sessionAlive)) {
//        $('#join-meeting').removeAttr('style').removeClass('render-spinner').addClass('render-retrying');
//    }

//    vdoPlugin.sessionAlive = setInterval(function () {
//        // if (vdoPlugin.sessionAliveAttempts > 0) {
//            window.hideSpinner = true;
//            Services.getMeetingDetail({sessionId: vdoPlugin.meeting.SessionId }).then(function (res) {
//                var Session = res.Payload;
//                Session.IsAlive = moment.utc().diff(moment.utc(Session.DateModified), 'seconds') <= 10;
//                // vdoPlugin.sessionAliveAttempts--;
//                if ( Session.IsAlive ) {
//                    clearInterval(vdoPlugin.sessionAlive);
//                    delete(vdoPlugin.sessionAlive);
//                    // delete(vdoPlugin.sessionAliveAttempts);
//                    $('#join-meeting').fadeOut().attr('style', 'display: none !important;').removeClass('render-spinner render-retrying');
//                    BookSession.startCheckDrop();
//                }
//            });
//        // } else {
//        //     clearInterval(vdoPlugin.sessionAlive);
//        //     // delete(vdoPlugin.sessionAliveAttempts);
//        //     vdoPlugin.endCall(vdoPlugin.vdoConnector);
//        // }
//    }, 2000);
//}

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

vdoPlugin.switchToPresenterCamera = function () {

    if (vdoPlugin.streamerCamera) {

        vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer');
        vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.streamerCamera);
    }
}

vdoPlugin.swithToCoHostCamera = function (participantID) {

    if (participantID) {

        var arrayLength = vdoPlugin.coHostPresenters.length;

        for (var i = 0; i < arrayLength; i++) {

            var ID = vdoPlugin.coHostPresenters[i].GetID();

            if (ID == participantID) {

                vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer');

                vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.coHostPresenters[i].camera);

                break;
            }
        }
    }
}

async function postAsync(url) {

    let response = await fetch(url, { method: 'POST' });

    return response;
}

// This function is used to ping our remote server to know if the app is currenly online or not.
function Ping() {

    // URL to be pinged is hardcoded for now.
    postAsync("https://forum360dev.azurewebsites.net/api/Ping/Index").then(function (response) {

        if (response.ok && response.status == 200) {

            vdoPlugin.connectionState = connectionStates.ONLINE;

        } else {

            vdoPlugin.connectionState = connectionStates.OFFLINE;
        }
    }).catch(function (err) {

        vdoPlugin.connectionState = connectionStates.OFFLINE;
    });
}

vdoPlugin.Update = function () {

    //for now commenting out the ping
    /////Ping();

    if (vdoPlugin.vidyoConnectorState == vidyoConnectionState.CONNECTION_LOST && vdoPlugin.connectionState == connectionStates.ONLINE) {

        // If we know that our Vidyo Connector has abnormally lost connection and now we are online again then we have to attempt to re-join to the same meeting again.

        vdoPlugin.autoJoinMeeting();

        vdoPlugin.vidyoConnectorState = vidyoConnectionState.ESTABLISHING_CONNECTION;
    }
}

vdoPlugin.registerEvents = function (vdoConnector) {

    vdoPlugin.selectedSpeaker = false;

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
        },
        onDynamicChanged: function (participants) {
            /* Ordered array of participants according to rank */
        },
        onLoudestChanged: function (participant, audioOnly) { /* Current loudest speaker */ }
    }).then(function () {
        vdoPlugin.initUserUsage();
        setInterval(vdoPlugin.Update, 1000);
        console.log("RegisterParticipantEventListener Success");
    }).catch(function () {
        console.err("RegisterParticipantEventListener Failed");
    });

    vdoConnector.RegisterRemoteCameraEventListener({
        onAdded: function (camera, participant) {
            if (participant.name === vdoPlugin.settings.producerName) {
                vdoPlugin.cameras.push(camera.objId);
                vdoPlugin.streamerCamera = camera;
                if (vdoPlugin.meeting.SessionStatus !== EMeetingStatus.Paused) {
                    vdoPlugin.showStreamerCamera(vdoConnector, camera);
                } else {
                    vdoPlugin.hideViewRenderer(vdoConnector, 'renderer');
                }
            }
            else {

                //// Searching for this participant in our list of Co-Host Presenters to add camera object to CoHostPresenter.
                var arrayLength = vdoPlugin.coHostPresenters.length;

                for (var i = 0; i < arrayLength; i++) {

                    var ID = vdoPlugin.coHostPresenters[i].GetID();

                    if (ID == participant.userId) {

                        vdoPlugin.coHostPresenters[i].camera = camera;

                        // Show added camera only if we have a Co-Host Presenter is currently on Active Stream and it's ID coincides with selected Co-Host Presenter which is on Active Stream now.
                        if (vdoPlugin.activeStreamState == streamStates.CO_HOST_PRESENTER && vdoPlugin.selectedCoHostID == ID) {

                            if (vdoPlugin.meeting.SessionStatus !== EMeetingStatus.Paused) {

                                vdoPlugin.showStreamerCamera(vdoPlugin.vdoConnector, vdoPlugin.coHostPresenters[i].camera);
                            }
                        }

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
                //if (producerJoinTime != 0 && producerJoinTime > producerLeaveTime)
                if (_.isEmpty(vdoPlugin.cameras)) {
                    vdoPlugin.hideViewRenderer(vdoConnector, 'renderer');
                }

                //// This code doesn't work and seems never worked. The call to BookSession.checkMeetingStatus returns 'undefined', not the expected number result.
                //if (BookSession.checkMeetingStatus(vdoPlugin.meeting.SessionId) == 3) {
                //    BookSession.getSpeakerReview();
                //    BookSession.showReviewForm();
                //    vdoPlugin.endCall();
                //}
                ////
            }
            else {

                //// Searching for this participant in our list of Co-Host Presenters to remove camera object from CoHostPresenter object.
                var arrayLength = vdoPlugin.coHostPresenters.length;

                for (var i = 0; i < arrayLength; i++) {

                    var ID = vdoPlugin.coHostPresenters[i].GetID();

                    if (ID == participant.userId) {

                        vdoPlugin.coHostPresenters[i].camera = null;

                        // If camera of currently selected for Active Stream Co-Host Presenter gets removed then we have to hide 'renderer' so meeting background image will be visible.
                        if (vdoPlugin.selectedCoHostID == ID) {

                            vdoPlugin.hideViewRenderer(vdoConnector, 'renderer');
                        }

                        break;
                    }
                }
                ////
            }
        },
        onStateUpdated: function (camera, participant, state) {
            // Camera state was updated
        }
    }).then(function () {
        console.log("RegisterRemoteCameraEventListener Success");
    }).catch(function () {
        console.error("RegisterRemoteCameraEventListener Failed");
    });

    /* custom remote participant's window share view */
    vdoConnector.RegisterRemoteWindowShareEventListener({
        onAdded: function (remoteWindowShare, participant) {
            /* New window is available for sharing. */
            if (participant.name === vdoPlugin.settings.producerName) {

                // Within this onAdded event we receive the participants remote Window Share object as well as remote Monitor Share object.
                // And we cannot distinguish which one is a Monitor and which one is a Window.
                // Solution:
                // We must never have more than one object here. So on Producer App / Forum 360 Studio side we have to deselect a Window before selecting a Monitor and vise versa.
                // So we always have here only one remoteWindowShare object.
                // If we don't do this then there will a bug with switching between shared Monitor and shared Window when only last object will be shown in WL.

                vdoPlugin.windowShares.push(remoteWindowShare.objId);
                vdoPlugin.remoteWindowShare = remoteWindowShare;
                setTimeout(() => {
                    vdoConnector.AssignViewToRemoteWindowShare({
                        viewId: 'rendererShare',
                        remoteWindowShare: remoteWindowShare,
                        displayCropped: false,
                        allowZoom: true
                    }).then(function (retValue) {

                        BookSession.UpdateActiveStreamFromDB();

                        if (vdoPlugin.meeting.SessionStatus !== 5) {
                            vdoPlugin.showViewRenderer(vdoConnector, 'rendererShare');
                        } else {
                            vdoPlugin.hideViewRenderer(vdoConnector, 'rendererShare');
                        }

                    }).catch(function () {
                        console.log("AssignViewToRemoteWindowShare Failed");
                    });
                }, 500);
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
                    vdoPlugin.hideViewRenderer(vdoConnector, 'rendererShare').then(function () {
                        BookSession.UpdateActiveStreamFromDB();
                    });
                }
            }
        },
        onStateUpdated: function (remoteWindowShare, participant, state) {
            /* Window share state was updated */
        }
    }).then(function () {

        console.log("RegisterRemoteWindowShareEventListener Success");

        BookSession.UpdateActiveStreamFromDB();

        if (vdoPlugin.meeting.SessionStatus == EMeetingStatus.Paused) {
            vdoPlugin.isMeetingPaused = true;
        }
    }).catch(function () {
        console.error("RegisterRemoteWindowShareEventListener Failed");
    });

    vdoConnector.RegisterLocalCameraEventListener({
        onAdded: function (localCamera) {
            // New camera is available
            vdoConnector.SelectLocalCamera({ localCamera: null });
        },
        onRemoved: function (localCamera) {
            // Existing camera became unavailable
        },
        onSelected: function (localCamera) {
            // Camera was selected/unselected by you or automatically
            // vdoConnector.SelectLocalCamera({
            //     localCamera: null
            // }).then(function () {
            //     // console.log("SelectMicrophone Success");
            // }).catch(function () {
            //     // console.error("SelectMicrophone Failed");
            // });
        },
        onStateUpdated: function (localCamera, state) {
            // Camera state was updated
        }
    }).then(function () {
        console.log("RegisterLocalCameraEventListener Success");
        //vdoConnector.SetCameraPrivacy({ privacy: true });
        //vdoConnector.SetMicrophonePrivacy({ privacy: false });
        //vdoConnector.SetSpeakerPrivacy({ privacy: false });

    }).catch(function () {
        // console.error("RegisterLocalCameraEventListener Failed");
    });

    vdoConnector.RegisterLocalMicrophoneEventListener({
        onAdded: function (localMicrophone) {
            // New microphone is available
            // Microphone was selected/unselected by you or automatically
            vdoConnector.SelectLocalMicrophone({ localMicrophone: null });
        },
        onRemoved: function (localMicrophone) {
            // Existing microphone became unavailable
        },
        onSelected: function (localMicrophone) {
            // Microphone was selected/unselected by you or automatically
            // vdoConnector.SelectLocalMicrophone({
            //     localMicrophone: null
            // }).then(function () {
            //     // console.log("SelectMicrophone Success");
            // }).catch(function () {
            //     console.error("SelectMicrophone Failed");
            // });
        },
        onStateUpdated: function (localMicrophone, state) {
            // Microphone state was updated
        }
    }).then(function () {
        console.log("RegisterLocalMicrophoneEventListener Success");
        vdoConnector.SetMicrophonePrivacy({ privacy: true });
    }).catch(function () {
        console.error("RegisterLocalMicrophoneEventListener Failed");
    });

    vdoConnector.RegisterLocalSpeakerEventListener({
        onAdded: function (localSpeaker) {
            if (localSpeaker.name.toUpperCase() == "DEFAULT" || !vdoPlugin.selectedSpeaker) {
                vdoPlugin.selectedSpeaker = true;

                vdoConnector.SelectLocalSpeaker({
                    localSpeaker: localSpeaker
                }).then(function () {
                    console.log("SelectSpeaker Success");
                }).catch(function () {
                    console.error("SelectSpeaker Failed");
                });
            }

            if (vdoPlugin.isMeetingPaused) {
                // Muting selected speaker (device) if the meeting is paused.
                if (vdoPlugin.vdoConnector) {

                    vdoPlugin.vdoConnector.SetSpeakerPrivacy({ privacy: true }).then(function () {

                        console.log("On meeting pause: SetSpeakerPrivacy Success");

                    }).catch(function () {

                        console.error("On meeting pause: SetSpeakerPrivacy Failed");
                    });
                }
            }
            // New speaker is available
        },
        onRemoved: function (localSpeaker) {
            // Existing speaker became unavailable
        },
        onSelected: function (localSpeaker) {
            
        },
        onStateUpdated: function (localSpeaker, state) {
            // Speaker state was updated
        }
    }).then(function () {

        console.log("RegisterLocalSpeakerEventListener Success");

    }).catch(function () {

        console.error("RegisterLocalSpeakerEventListener Failed");
    });
};

vdoPlugin.receiveMessageHandle = function (message, data) {
    switch (message) {

        case '[SWITCH-CAMERA]':
            BookSession.swapScreen(true); // Switching to "renderer" view.

            if (!vdoPlugin.isMeetingPaused) {
                // We assign camera view to 'div' block only if the meeting isn't paused now.
                vdoPlugin.switchToPresenterCamera();
            }

            vdoPlugin.activeStreamState = streamStates.MAIN_PRESENTER;
            vdoPlugin.selectedCoHostID = '';
            break;

        case '[SWITCH-SHAREDWINDOW]':
            BookSession.swapScreen(false); // Switching to "rendererShare" view.
            vdoPlugin.activeStreamState = streamStates.PRESENTATION;
            vdoPlugin.selectedCoHostID = '';
            break;

        case '[SWITCH-TO-REMOTE-CAM]':

            var participantID = data;

            if (participantID) {
                BookSession.swapScreen(true); // Switching to "renderer" view.

                if (!vdoPlugin.isMeetingPaused) {
                    // We assign camera view to 'div' block only if the meeting isn't paused now.
                    vdoPlugin.swithToCoHostCamera(participantID); // Passing participant's ID into switching function so corrent Co-Host Presenter's remote camera will be chosen and assigned to 'render' view.
                }
                
                vdoPlugin.activeStreamState = streamStates.CO_HOST_PRESENTER;
                vdoPlugin.selectedCoHostID = participantID;
            }

            break;

        case '[PAUSEMEETING]':

            console.log("[PAUSEMEETING] command received.");

            vdoPlugin.isMeetingPaused = true;
            vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'renderer');
            vdoPlugin.hideViewRenderer(vdoPlugin.vdoConnector, 'rendererShare');

            // Muting selected speaker (device) if the meeting is paused.
            if (vdoPlugin.vdoConnector) {

                vdoPlugin.vdoConnector.SetSpeakerPrivacy({ privacy: true }).then(function () {

                    console.log("On meeting pause: SetSpeakerPrivacy Success");

                }).catch(function () {

                    console.error("On meeting pause: SetSpeakerPrivacy Failed");
                });
            }
            
            break;

        case '[RESUMEMEETING]':

            console.log("[RESUMEMEETING] command received.");

            vdoPlugin.isMeetingPaused = false;

            if (vdoPlugin.activeStreamState == streamStates.MAIN_PRESENTER) {

                vdoPlugin.showStreamerCamera (vdoPlugin.vdoConnector, vdoPlugin.streamerCamera);

            } else if (vdoPlugin.activeStreamState == streamStates.PRESENTATION) {

                vdoPlugin.showRemoteWindowShare (vdoPlugin.vdoConnector, vdoPlugin.remoteWindowShare);

            } else if (vdoPlugin.activeStreamState == streamStates.CO_HOST_PRESENTER) {

                vdoPlugin.swithToCoHostCamera(vdoPlugin.selectedCoHostID);
            }

            // Unmuting selected speaker (device) if the meeting is resumed.
            if (vdoPlugin.vdoConnector) {

                vdoPlugin.vdoConnector.SetSpeakerPrivacy ({ privacy: false }).then (function () {

                    console.log("On meeting resume: SetSpeakerPrivacy Success");

                }).catch(function () {

                    console.error("On meeting resume: SetSpeakerPrivacy Failed");
                });
            }
            
            break;

        case '[ENDMEETING]':

            if (vdoPlugin.meeting.VimeoOnly) {

                // This will hide spinner. So meeting ending won't have screens blinking.
                $('#join-meeting').removeAttr('style').removeClass('render-retrying').removeClass('render-spinner');

                // This will stop Vimeo Player.
                BookSession.vimeoIFrame.setAttribute('src', '');
            } else {

                $('#renderer', document).trigger('vdo.call.stop');
            }

            $('.book-session', document).trigger('session.review.show');
            break;

        case '[QUESTION-NEW]':
            break;

        default:
            break;
    }
}

vdoPlugin.startCall = function (vdoConnector) {

    // $('#join-meeting').remove();

    console.log("START CALL");

    vdoPlugin.vidyoConnectorState = vidyoConnectionState.ESTABLISHING_CONNECTION;
    //vdoConnector.Connect({
    vdoConnector.ConnectToRoomAsGuest({
        // Take input from options form
        host: vdoPlugin.settings.hostName,
        roomKey: vdoPlugin.settings.roomKey,
        displayName: vdoPlugin.settings.userName,
        roomPin: vdoPlugin.settings.roomPin,

        // Define handlers for connection events.
        onSuccess: function (reason) {
            //console.log( window.location.href + '?host=' + hostName + '&displayName=' + displayName + '&resourceId=' + resourceId + '&autoJoin=1' + '&token=' + vdoPlugin.settings.token);
            console.log("vidyoConnector.Connect : onSuccess callback received", reason, "displayName = ", vdoPlugin.settings.userName);
            $('.book-session', document).trigger('meeting.call.joined');
            // BookSession.startCheckDrop();

            vdoPlugin.vidyoConnectorState = vidyoConnectionState.CONNECTED;
        },
        onFailure: function (reason) {
            // Failed
            console.error("vidyoConnector.Connect : onFailure callback received");
            switch (reason) {
                case 'VIDYO_CONNECTORFAILREASON_InvalidToken':
                    // We should update this logic
                    Utility.showMessage(".message-noti", "Something wrong from video server. Please refresh page to retry or contact support if remaining.", "error");
                    Services.getJoinToken({
                        eventKey: vdoPlugin.meeting.EventKey,
                        sessionId: vdoPlugin.meeting.SessionId
                    }).then(function (res) {
                        if (vdoConnector && !_.isUndefined(res.Payload.VidyoToken)) {
                            vdoPlugin.settings.token = res.Payload.VidyoToken;
                            vdoPlugin.settings.roomPin = res.Payload.roomPin;
                            vdoPlugin.settings.roomKey = res.Payload.roomKey;
                            $('#renderer', document).trigger('vdo.call.start');
                        }
                    });

                    vdoPlugin.vidyoConnectorState = vidyoConnectionState.DISCONNECTED;

                    break;

                case 'VIDYO_CONNECTORDISCONNECTREASON_MiscError':

                    vdoPlugin.vidyoConnectorState = vidyoConnectionState.CONNECTION_LOST;

                    break;

                default:
                    break;
            }
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

            //// TEST
            console.log("vdoPlugin.meeting.SessionStatus: " + vdoPlugin.meeting.SessionStatus);
            console.log("vdoPlugin.isMeetingPaused: " + vdoPlugin.isMeetingPaused);
            ////

            // If latest read meeting status from DB is "Pause" but we've got from SignalR Hub that the meeting is resumed then we have to fix this.
            // This fix for the issue when Forum 360 Studio app sends "Resume" meeting command after we've just joined the meeting but earlier than the Vidyo connector is successfully connected.
            // To test this case you need to have meeting paused before launching WL. Then when have pressed "Play" button to join the meeting just after circling indicator dissappears click "Resume" button in F360S.
            // Without this fix "Resume" SignalR Hub command won't resume meeting in WL.
            if (vdoPlugin.meeting.SessionStatus == EMeetingStatus.Paused && vdoPlugin.isMeetingPaused == false) {

                vdoPlugin.meeting.SessionStatus = EMeetingStatus.Started;
            }

            //sClient.ConnectToGroup(); // This is now called earlier in different place.
            sClient.hideNetwork();
        } else {
            console.error("Connect Failed");
        }
    }).catch(function () {
        console.error("Connect Failed");
    });
};

vdoPlugin.endCall = function (vdoConnector) {
    $('#join-meeting').removeAttr('style').removeClass('render-retrying').removeClass('render-spinner');
    vdoConnector.Disconnect().then(function () {
        //vdoConnector.Disable();
        vdoConnector.HideView('videoRender');
        if (vdoPlugin.isFullScreenCurrently()) {
            vdoPlugin.closeFullscreen();
        }
        // delete (vdoConnector);
        vdoPlugin.isCalling = false;
        console.log("Disconnect Success");
    }).catch(function () {
        console.error("Disconnect Failure");
    });
};

vdoPlugin.switchScreen = function () {
    return "[Switch-Sharescreen],[Switch-Camera]"
};

vdoPlugin.sendQuestionMsg = function () {

};

vdoPlugin.currentFullScreenElement = function () {
    return (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null);
};

vdoPlugin.openFullscreen = function (elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
};

vdoPlugin.closeFullscreen = function () {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
    }
};

vdoPlugin.isFullScreenCurrently = function () {
    var full_screen_element = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;

    // If no element is in full-screen
    if (full_screen_element === null)
        return false;
    else
        return true;
};

vdoPlugin.keepRenderRatio = function () {
    // $('.video-renderer, #renderer, #rendererShare').height(function () {
    //     var height = $(this).width() * 0.5625;
    //     return height < 200 ? 320 : height;
    // });
};

vdoPlugin.fullscreenEvents = function () {
    var elem = document.getElementById('rendererWrapper');
    $(document)
        .on('dblclick', '#renderer', function (e) {
            vdoPlugin.openFullscreen(elem);
        })
        .on('fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange', function (e) {
            if (vdoPlugin.isFullScreenCurrently()) {
                $('#rendererWrapper').addClass('zoom');
                $('#zoomButton>i').attr('class', 'fa fa-arrows');
            } else {
                $('#rendererWrapper').removeClass('zoom');
                $('#zoomButton>i').attr('class', 'fa fa-arrows-alt');
            }
        })
        .on('click', '.zoomButton', function () {
            if (vdoPlugin.isFullScreenCurrently()) {
                vdoPlugin.closeFullscreen();
            } else {
                vdoPlugin.openFullscreen(elem);
            }
        });
};

vdoPlugin.CreateVidyoConnector = function (VC) {
    VC.CreateVidyoConnector({
        viewId: null, //'videoRender', // Div ID where the composited video will be rendered, see VidyoConnector.html;
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 1, // Maximum number of participants to render
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
        logFileName: "",
        userData: "",
        constraints: {
            location: false,
            mediaConstraints: {
                audio: false,
                video: false
            }
        }
    }).then(function (vc) {
        vdoPlugin.vdoConnector = vc;
        vdoPlugin.registerEvents(vdoPlugin.vdoConnector);
        /*
        $(document)
            .on('vdo.call.start', '#renderer', function (event) {
                vdoPlugin.startCall(vdoPlugin.vdoConnector);
            })
            .on('vdo.call.stop', '#renderer', function (event) {
                vdoPlugin.endCall(vdoPlugin.vdoConnector);
            });
            */
        // We have to connect to the Hub meeting group earlier to be able to process remote commands as soon as possible.
        // If we first joing the meeting and read it's "Paused/Unpaused" status and before we connect to the Hub group we won't receive any SignalR commands from Forum 360 Studio.
        //sClient.ConnectToGroup();

        // Auto join meeting
        // vdoPlugin.startCall(vdoPlugin.vdoConnector);
        vdoPlugin.autoJoinMeeting();
    })
        .catch(function (err) {
            console.error("CreateVidyoConnector Failed " + err);
        });
};

vdoPlugin.joinMeeting = function () {
    Services.getJoinToken({
        eventKey: vdoPlugin.meeting.EventKey,
        sessionId: vdoPlugin.meeting.SessionId
    })
        .then(function (res) {
            if (!_.isUndefined(res.Payload) && !_.isUndefined(res.Payload.VidyoToken) && res.Payload.Success) {
                vdoPlugin.settings = _.merge(vdoPlugin.settings, {
                    token: res.Payload.VidyoToken,
                    userName: helpers.localStorage.get(f360.dataPrefix + 'UserInfo').UserKey,
                    resourceId: CurrentEvent.getResourceId(CurrentEvent.meeting.EventKey, CurrentEvent.meeting.SessionId),
                    roomKey: res.Payload.roomKey,
                    roomPin: res.Payload.RoomPin
                });

                BookSession.UpdateActiveStreamFromDB().then(function () {
                    vdoPlugin.startCall(VidyoConnector);
                });
            } else {
                $.notify('Failed to get authentication code, please try again.');
            }

            return res;
        })
        .then(function () {
            // $('body').trigger('event.call.start');
        });
};

vdoPlugin.autoJoinMeeting = function () {
    window.hideSpinner = true;

    BookSession.joinMeeting()
        .then(function (res) {
            $('#join-meeting').fadeOut().attr('style', 'display: none !important;');
            vdoPlugin.settings.token = res.Payload.VidyoToken;
            vdoPlugin.settings.roomKey = res.Payload.roomKey;
            vdoPlugin.settings.roomPin = res.Payload.roomPin;
            vdoPlugin.startCall(vdoPlugin.vdoConnector);
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
    vdoPlugin.fullscreenEvents();
};

vdoPlugin.initialize = function (event) {
    $(document).on('click touchmove', '#join-meeting', function () {
        $(this).addClass('render-spinner');
        if (!vdoPlugin.meeting.VimeoOnly) {
            vdoPlugin.loadVdoLib();
        }
    });
    vdoPlugin.events();
};

$(function () {
    vdoPlugin.initialize();
});
