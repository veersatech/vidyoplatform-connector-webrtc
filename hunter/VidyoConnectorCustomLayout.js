const OPEN_REMOTE_SLOT = "-1";
//these global onbjects aare only for testing (to be able to use them from console)
var globalRemoteShare = null;
var globalCamera = null;
var last_pos = 3;
var last_cam_pos = 1;
var globalRemoteCameraTile = null;
function ShowRenderer(vidyoConnector, divId) {
    var rndr = document.getElementById(divId);
    //This method do not start rendering or so, but it say to VidyoRouter which quality we expect, 
    //for example, if we recieve fullHD stream but only 640x320 window - we waste resources of CPu and bandwith. 
    //But if we will call ShowViewAt(width:630, heigh:320) then router will send video with resoultuion that best mach rendere size
    if (rndr)
        vidyoConnector.ShowViewAt({ viewId: divId, x: rndr.offsetLeft, y: rndr.offsetTop, width: rndr.offsetWidth, height: rndr.offsetHeight });
}

// Run StartVidyoConnector when the VidyoClient is successfully loaded
function StartVidyoConnector(VC, webrtc) {
    var vidyoConnector;
    var cameras = {};
    var microphones = {};
    var speakers = {};
    var selectedLocalCamera = { id: 0, camera: null };
    var cameraPrivacy = false;
    var microphonePrivacy = false;
    var speakerPrivacy = false;
    var remoteCameras = {};
    var configParams = {};

    // rendererSlots[0] is used to render the local camera;
    // rendererSlots[1] through rendererSlots[5] are used to render up to 5 cameras from remote participants.
    var rendererSlots = ["1", OPEN_REMOTE_SLOT, OPEN_REMOTE_SLOT, OPEN_REMOTE_SLOT, OPEN_REMOTE_SLOT, OPEN_REMOTE_SLOT];

    window.onresize = function () {
        showRenderers();
    };

    VC.CreateVidyoConnector({
        viewId: null, // Set to null in order to create a custom layout
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 16,     // Maximum number of participants to render
        logFileFilter: "warning info@VidyoClient info@VidyoConnector",
        logFileName: "VidyoConnector.log",
        userData: 0,
        constraints: {
            disableGoogleAnalytics: true
        }
    }).then(function (vc) {
        vidyoConnector = vc;
        parseUrlParameters(configParams);
        registerDeviceListeners(vidyoConnector, cameras, microphones, speakers, rendererSlots, selectedLocalCamera, remoteCameras);
        regiserModerationListeners(vidyoConnector);
        registerAdvancedSettingsListeners(vidyoConnector);
        handleAdvancedSettingsChange(vidyoConnector);
        handleDeviceChange(vidyoConnector, cameras, microphones, speakers);
        handleParticipantChange(vidyoConnector, rendererSlots, remoteCameras);
        handleSharing(vidyoConnector, webrtc);
        //just a sample how we can handle new remote share
        handleRemoteSharing();

        // Populate the connectionStatus with the client version
        vidyoConnector.GetVersion().then(function (version) {
            $("#clientVersion").html("v " + version);
        }).catch(function () {
            console.error("GetVersion failed");
        });

        // If enableDebug is configured then enable debugging
        if (configParams.enableDebug === "1") {
            vidyoConnector.EnableDebug({ port: 7776, logFilter: "warning info@VidyoClient info@VidyoConnector" }).then(function () {
                console.log("EnableDebug success");
            }).catch(function () {
                console.error("EnableDebug failed");
            });
        }

        // Join the conference if the autoJoin URL parameter was enabled
        if (configParams.autoJoin === "1") {
            joinLeave();
        } else {
            // Handle the join in the toolbar button being clicked by the end user.
            $("#joinLeaveButton").one("click", joinLeave);
        }
    }).catch(function (err) {
        console.error("CreateVidyoConnector Failed " + err);
    });

    // Handle the camera privacy button, toggle between show and hide.
    $("#cameraButton").click(function () {
        // CameraPrivacy button clicked
        cameraPrivacy = !cameraPrivacy;
        vidyoConnector.SetCameraPrivacy({
            privacy: cameraPrivacy
        }).then(function () {
            console.log("SetCameraPrivacy Success");
        }).catch(function () {
            console.error("SetCameraPrivacy Failed");
        });
    });

    // Handle the microphone mute button, toggle between mute and unmute audio.
    $("#microphoneButton").click(function () {
        // MicrophonePrivacy button clicked
        microphonePrivacy = !microphonePrivacy;
        vidyoConnector.SetMicrophonePrivacy({
            privacy: microphonePrivacy
        }).then(function () {
            console.log("SetMicrophonePrivacy Success");
        }).catch(function () {
            console.error("SetMicrophonePrivacy Failed");
        });
    });

    $("#speakerButton").click(function () {
        speakerPrivacy = !speakerPrivacy;
        vidyoConnector.SetSpeakerPrivacy({
            privacy: speakerPrivacy
        }).then(function () {
            if (speakerPrivacy) {
                $("#speakerButton").addClass("speakerOff").removeClass("speakerOn");
            } else {
                $("#speakerButton").addClass("speakerOn").removeClass("speakerOff");
            }
            console.log("SetSpeakerPrivacy Success");
        }).catch(function () {
            console.error("SetSpeakerPrivacy Failed");
        });
    });


    $("#moveCam").click(function () {
        var val = document.getElementById("locCam").value; 
        var camera = globalRemoteCameraTile;
        //Hiding the view first, before the AssignViewToRemoteCamera to avoid leaks
        last_pos_renderer = "renderer" + last_cam_pos;

        vidyoConnector.HideView({ viewId: last_pos_renderer }).then(function () {
            console.log("HideView Success");
            //start render remote share in div block with id renderer3
            pos_renderer = "renderer" + val
            setTimeout(() => {
                vidyoConnector.AssignViewToRemoteCamera({
                    viewId: pos_renderer,
                    remoteCamera: camera,
                    displayCropped: true,
                    allowZoom: false
                }).then(function (retValue) {
                    last_cam_pos = val;
                    console.log("AssignViewToRemoteCamera " + camera + " to slot " + " = " + retValue);
                    ShowRenderer(vidyoConnector, pos_renderer);
                }).catch(function () {
                    console.log("AssignViewToRemoteCamera Failed");
                });
            }, 1000);
        });
    });


    $("#move").click(function () {
        var val = document.getElementById("loc").value;
        //only for test purposes
        var remoteShare = globalRemoteShare
        //Hiding the view first, before the AssignViewToRemoteCamera to avoid leaks
        last_pos_renderer = "renderer" + last_pos
        vidyoConnector.HideView({ viewId: last_pos_renderer }).then(function () {
            console.log("HideView Success");
            //start render remote share in div block with id renderer3
            pos_renderer = "renderer" + val
            setTimeout(() => {
                vidyoConnector.AssignViewToRemoteWindowShare({
                    viewId: pos_renderer,
                    remoteWindowShare: remoteShare,
                    displayCropped: true,
                    allowZoom: false
                }).then(function (retValue) {
                    last_pos = val;
                    console.log("AssignViewToRemoteWindowShare " + remoteShare + " to slot 3" + " = " + retValue);
                    ShowRenderer(vidyoConnector, pos_renderer);
                }).catch(function () {
                    console.log("AssignViewToRemoteWindowShare Failed");
                });
            }, 1000);
        });
    });

    function joinLeave() {
        // join or leave dependent on the joinLeaveButton, whether it
        // contains the class callStart or callEnd.
        if ($("#joinLeaveButton").hasClass("callStart")) {
            $("#connectionStatus").html("Connecting...");
            $("#joinLeaveButton").removeClass("callStart").addClass("callEnd");
            $('#joinLeaveButton').prop('title', 'Leave Conference');
            connectToConference(vidyoConnector, rendererSlots, remoteCameras, configParams);
        } else {
            $("#connectionStatus").html("Disconnecting...");
            vidyoConnector.Disconnect().then(function () {
                console.log("Disconnect Success");
            }).catch(function () {
                console.error("Disconnect Failure");
            });
        }
        $("#joinLeaveButton").one("click", joinLeave);
    }

    $("#optionsVisibilityButton").click(function () {
        $("body").toggleClass("options-hidden");
    });

    $("body").removeClass("options-hidden");

    $('#renderer-group').dblclick((event) => {
        const $renderer = $(event.target).closest('.pluginOverlay').not(':empty');

        $('.pluginOverlay').not($renderer).removeClass('zoomed-in');
        $renderer.toggleClass('zoomed-in');
    });
}

function registerAdvancedSettingsListeners(vidyoConnector) {
    var setActiveLogs;
    vidyoConnector._registerAdvancedSettingsEventListener({
        onAddGoogleConferenceFlagChanged: function (addGoogleConferenceFlag) {
            $('#advanced-addGoogleConferenceFlag').prop('checked', addGoogleConferenceFlag);
        },
        onLogCategoryChanged: function (logs) {
            if (logs.logLevel && !setActiveLogs) {
                createTable(logs);
                setActiveLogs = setActiveLogLevels(logs.activeLogs, logs.logLevel);
                setActiveLogs(logs.activeLogs);
            } else {
                setActiveLogs(logs)
            }
        },
        onDisableStatsChanged: function (disableStats) {
            $('#advanced-disableStats').prop('checked', disableStats);
        },
        onEnableSimpleAPILoggingChanged: function (enableSimpleAPILogging) {
            $('#advanced-loggingSimpleAPIMethods').prop('checked', enableSimpleAPILogging);
        },
        onEnableVidyoConnectorAPILoggingChanged: function (enableVidyoConnectorAPILogging) {
            $('#advanced-loggingVidyoConnectorAPI').prop('checked', enableVidyoConnectorAPILogging);
        },
        onEnableSimulcastChanged: function (enableSimulcast) {
            $('#advanced-enableSimulcast').prop('checked', enableSimulcast);
        },
        onEnableTransportCcChanged: function (enableTransportCc) {
            $('#advanced-enableTransportCc').prop('checked', enableTransportCc);
        },
        onEnableUnifiedPlanChanged: function (enableUnifiedPlan) {
            $('#advanced-enableUnifiedPlan').prop('checked', enableUnifiedPlan);
        },
        onParticipantLimitChanged: function (participantLimit) {
            $('#advanced-participantLimit').val(participantLimit);
        },
        onShowStatisticsOverlayChanged: function (showStatisticsOverlay) {
            $('#advanced-showStatisticsOverlay').prop('checked', showStatisticsOverlay);
        },
    });
}

function registerDeviceListeners(vidyoConnector, cameras, microphones, speakers, rendererSlots, selectedLocalCamera, remoteCameras) {
    // Map the "None" option (whose value is 0) in the camera, microphone, and speaker drop-down menus to null since
    // a null argument to SelectLocalCamera, SelectLocalMicrophone, and SelectLocalSpeaker releases the resource.
    cameras[0] = null;
    microphones[0] = null;
    speakers[0] = null;

    // Handle appearance and disappearance of camera devices in the system
    vidyoConnector.RegisterLocalCameraEventListener({
        onAdded: function (localCamera) {
            // New camera is available
            $("#cameras").append("<option value='" + window.btoa(localCamera.id) + "'>" + localCamera.name + "</option>");
            $("#cameraShare").append("<option value='" + window.btoa(localCamera.id) + "'>" + localCamera.name + "</option>");
            cameras[window.btoa(localCamera.id)] = localCamera;
        },
        onRemoved: function (localCamera) {
            // Existing camera became unavailable
            $("#cameras option[value='" + window.btoa(localCamera.id) + "']").remove();
            $("#cameraShare option[value='" + window.btoa(localCamera.id) + "']").remove();
            delete cameras[window.btoa(localCamera.id)];

            // If the removed camera was the selected camera, then hide it
            if (selectedLocalCamera.id === localCamera.id) {
                vidyoConnector.HideView({ viewId: "renderer0" }).then(function () {
                    console.log("HideView Success");
                }).catch(function (e) {
                    console.log("HideView Failed");
                });
            }
        },
        onSelected: function (localCamera) {
            // Camera was selected/unselected by you or automatically
            if (localCamera) {
                $("#cameras option[value='" + window.btoa(localCamera.id) + "']").prop('selected', true);
                selectedLocalCamera.id = localCamera.id;
                selectedLocalCamera.camera = localCamera;

                // Assign view to selected camera
                vidyoConnector.AssignViewToLocalCamera({
                    viewId: "renderer0",
                    localCamera: localCamera,
                    displayCropped: true,
                    allowZoom: false
                }).then(function () {
                    console.log("AssignViewToLocalCamera Success");
                    ShowRenderer(vidyoConnector, "renderer0");
                }).catch(function (e) {
                    console.log("AssignViewToLocalCamera Failed");
                });
            } else {
                selectedLocalCamera.id = 0;
                selectedLocalCamera.camera = null;
            }
        },
        onStateUpdated: function (localCamera, state) {
            cameraPrivacy = state === 'VIDYO_DEVICESTATE_Stopped';
            if (cameraPrivacy) {
                // Hide the local camera preview, which is in slot 0
                $("#cameraButton").addClass("cameraOff").removeClass("cameraOn");
                vidyoConnector.HideView({ viewId: "renderer0" }).then(function () {
                    console.log("HideView Success");
                }).catch(function (e) {
                    console.log("HideView Failed");
                });
            } else {
                // Show the local camera preview, which is in slot 0
                $("#cameraButton").addClass("cameraOn").removeClass("cameraOff");
                vidyoConnector.AssignViewToLocalCamera({
                    viewId: "renderer0",
                    localCamera: selectedLocalCamera.camera,
                    displayCropped: true,
                    allowZoom: false
                }).then(function () {
                    console.log("AssignViewToLocalCamera Success");
                    ShowRenderer(vidyoConnector, "renderer0");
                }).catch(function (e) {
                    console.log("AssignViewToLocalCamera Failed");
                });
            }
        }
    }).then(function () {
        console.log("RegisterLocalCameraEventListener Success");
    }).catch(function () {
        console.error("RegisterLocalCameraEventListener Failed");
    });

    // Handle appearance and disappearance of microphone devices in the system
    vidyoConnector.RegisterLocalMicrophoneEventListener({
        onAdded: function (localMicrophone) {
            // New microphone is available
            $("#microphones").append("<option value='" + window.btoa(localMicrophone.id) + "'>" + localMicrophone.name + "</option>");
            microphones[window.btoa(localMicrophone.id)] = localMicrophone;
        },
        onRemoved: function (localMicrophone) {
            // Existing microphone became unavailable
            $("#microphones option[value='" + window.btoa(localMicrophone.id) + "']").remove();
            delete microphones[window.btoa(localMicrophone.id)];
        },
        onSelected: function (localMicrophone) {
            // Microphone was selected/unselected by you or automatically
            if (localMicrophone)
                $("#microphones option[value='" + window.btoa(localMicrophone.id) + "']").prop('selected', true);
        },
        onStateUpdated: function (localMicrophone, state) {
            microphonePrivacy = state === 'VIDYO_DEVICESTATE_Stopped';
            if (microphonePrivacy) {
                $("#microphoneButton").addClass("microphoneOff").removeClass("microphoneOn");
            } else {
                $("#microphoneButton").addClass("microphoneOn").removeClass("microphoneOff");
            }
        }
    }).then(function () {
        console.log("RegisterLocalMicrophoneEventListener Success");
    }).catch(function () {
        console.error("RegisterLocalMicrophoneEventListener Failed");
    });

    // Handle appearance and disappearance of speaker devices in the system
    vidyoConnector.RegisterLocalSpeakerEventListener({
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
        onStateUpdated: function (localSpeaker, state) {
            // Speaker state was updated
        }
    }).then(function () {
        console.log("RegisterLocalSpeakerEventListener Success");
    }).catch(function () {
        console.error("RegisterLocalSpeakerEventListener Failed");
    });

    vidyoConnector.RegisterRemoteCameraEventListener({
        onAdded: function (camera, participant) {
            // Store the remote camera for this participant
            remoteCameras[participant.id] = { camera: camera, isRendered: false };
            globalRemoteCameraTile = camera;
            // Scan through the renderer slots and look for an open slot.
            // If an open slot is found then assign it to the remote camera.
            for (var i = 1; i < rendererSlots.length; i++) {
                if (rendererSlots[i] === OPEN_REMOTE_SLOT) {
                    rendererSlots[i] = participant.id;
                    remoteCameras[participant.id].isRendered = true;
                    vidyoConnector.AssignViewToRemoteCamera({
                        viewId: "renderer" + (i),
                        remoteCamera: camera,
                        displayCropped: true,
                        allowZoom: false
                    }).then(function (retValue) {
                        console.log("AssignViewToRemoteCamera " + participant.id + " to slot " + i + " = " + retValue);
                        ShowRenderer(vidyoConnector, "renderer" + (i));
                    }).catch(function () {
                        console.log("AssignViewToRemoteCamera Failed");
                        rendererSlots[i] = OPEN_REMOTE_SLOT;
                        remoteCameras[participant.id].isRendered = false;
                    });
                    break;
                }
            }
        },
        onRemoved: function (camera, participant) {
            console.log("RegisterRemoteCameraEventListener onRemoved participant.id : " + participant.id);
            delete remoteCameras[participant.id];

            // Scan through the renderer slots and if this participant's camera
            // is being rendered in a slot, then clear the slot and hide the camera.
            for (var i = 1; i < rendererSlots.length; i++) {
                if (rendererSlots[i] === participant.id) {
                    rendererSlots[i] = OPEN_REMOTE_SLOT;
                    $(`#renderer${i}`).removeClass('zoomed-in');
                    console.log("Slot found, calling HideView on renderer" + i);
                    vidyoConnector.HideView({ viewId: "renderer" + (i) }).then(function () {
                        console.log("HideView Success");

                        // If a remote camera is not rendered in a slot, replace it in the slot that was just cleaered
                        for (var id in remoteCameras) {
                            if (!remoteCameras[id].isRendered) {
                                rendererSlots[i] = id;
                                remoteCameras[id].isRendered = true;
                                vidyoConnector.AssignViewToRemoteCamera({
                                    viewId: "renderer" + (i),
                                    remoteCamera: remoteCameras[id].camera,
                                    displayCropped: true,
                                    allowZoom: false
                                }).then(function (retValue) {
                                    console.log("AssignViewToRemoteCamera " + id + " to slot " + i + " = " + retValue);
                                    ShowRenderer(vidyoConnector, "renderer" + (i));
                                }).catch(function () {
                                    console.log("AssignViewToRemoteCamera Failed");
                                    rendererSlots[i] = OPEN_REMOTE_SLOT;
                                    remoteCameras[id].isRendered = false;
                                });
                                break;
                            }
                        }
                    }).catch(function (e) {
                        console.log("HideView Failed");
                    });
                    break;
                }
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
}

function regiserModerationListeners(vidyoConnector) {
    vidyoConnector.RegisterModerationCommandEventListener({
        onModerationCommandReceived: (deviceType, moderationType, state) => {
            console.log(`Moderation command received: deviceType: ${deviceType}, moderationType: ${moderationType}, state: ${state}`);
        }
    });
}

function handleAdvancedSettingsChange(vidyoConnector) {
    $('#advanced-addGoogleConferenceFlag').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ addGoogleConferenceFlag: $(this).prop('checked') });
    });
    $('#advanced-disableStats').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ disableStats: $(this).prop('checked') });
    });
    $('#advanced-enableSimulcast').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableSimulcast: $(this).prop('checked') });
    });
    $('#advanced-enableTransportCc').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableTransportCc: $(this).prop('checked') });
    });
    $('#advanced-enableUnifiedPlan').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableUnifiedPlan: $(this).prop('checked') });
    });
    $('#advanced-participantLimit').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ participantLimit: $(this).val() });
    });
    $('#advanced-showStatisticsOverlay').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ showStatisticsOverlay: $(this).prop('checked') });
    });
    $('#advanced-loggingXmppMessages').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableXMPPMessageLogging: $(this).prop('checked') });
    });
    $('#advanced-loggingSimpleAPIMethods').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableSimpleAPILogging: $(this).prop('checked') });
    });
    $('#advanced-loggingVidyoConnectorAPI').change(function () {
        vidyoConnector.SetAdvancedConfiguration({ enableVidyoConnectorAPILogging: $(this).prop('checked') });
    });
}

function handleDeviceChange(vidyoConnector, cameras, microphones, speakers) {
    // Hook up camera selector functions for each of the available cameras
    $("#cameras").change(function () {
        // Camera selected from the drop-down menu
        $("#cameras option:selected").each(function () {
            // Hide the view of the previously selected local camera
            vidyoConnector.HideView({ viewId: "renderer0" });

            // Select the newly selected local camera
            camera = cameras[$(this).val()];
            vidyoConnector.SelectLocalCamera({
                localCamera: camera
            }).then(function () {
                console.log("SelectCamera Success");
            }).catch(function () {
                console.error("SelectCamera Failed");
            });
        });
    });

    // Hook up microphone selector functions for each of the available microphones
    $("#microphones").change(function () {
        // Microphone selected from the drop-down menu
        $("#microphones option:selected").each(function () {
            microphone = microphones[$(this).val()];
            vidyoConnector.SelectLocalMicrophone({
                localMicrophone: microphone
            }).then(function () {
                console.log("SelectMicrophone Success");
            }).catch(function () {
                console.error("SelectMicrophone Failed");
            });
        });
    });

    // Hook up speaker selector functions for each of the available speakers
    $("#speakers").change(function () {
        // Speaker selected from the drop-down menu
        $("#speakers option:selected").each(function () {
            speaker = speakers[$(this).val()];
            vidyoConnector.SelectLocalSpeaker({
                localSpeaker: speaker
            }).then(function () {
                console.log("SelectSpeaker Success");
            }).catch(function () {
                console.error("SelectSpeaker Failed");
            });
        });
    });

    // Hook up camera selector functions for each of the available cameras
    $("#cameraShare").change(function () {
        // Camera selected from the drop-down menu
        $("#cameraShare option:selected").each(function () {
            const camera = cameras[$(this).val()];
            vidyoConnector.SelectVideoContentShare({
                localCamera: camera
            }).then(function () {
                console.log("SelectVideoContentShare Success");
            }).catch(function () {
                console.error("SelectVideoContentShare Failed");
            });
        });
    });
}

function handleSharing(vidyoConnector, webrtc) {
    var isSafari = navigator.userAgent.indexOf('Chrome') < 0 && navigator.userAgent.indexOf('Safari') >= 0;
    var monitorShares = {};
    var windowShares = {};
    var isSharingWindow = false;          // Flag indicating whether a window is currently being shared
    var isSharingMonitor = false;
    var webrtcMode = (webrtc === "true"); // Whether the app is running in plugin or webrtc mode

    // The monitorShares & windowShares associative arrays hold a handle to each window/monitor that are available for sharing.
    // The element with key "0" contains a value of null, which is used to stop sharing.
    monitorShares[0] = null;
    windowShares[0] = null;


    const selectLocalShare = (share) => {
        // Select the local window share
        vidyoConnector.SelectLocalWindowShare({
            localWindowShare: share
        }).then(function (isSelected) {
            if (!isSelected) {
                $("#windowShares option[value='0']").prop('selected', true);
            }
            console.log("SelectLocalWindowShare Success");
        }).catch(function (error) {
            // This API will be rejected in case any error occurred including:
            // - permission is not given on the OS level (macOS).
            $("#windowShares option[value='0']").prop('selected', true);
            console.error("SelectLocalWindowShare Failed:", error);
        });
    };

    const selectLocalMonitor = (share) => {
        // Select the local monitor
        vidyoConnector.SelectLocalMonitor({
            localMonitor: share
        }).then(function (isSelected) {
            if (!isSelected) {
                $("#monitorShares option[value='0']").prop('selected', true);
            }
            console.log("SelectLocalMonitor Success", isSelected);
        }).catch(function (error) {
            // This API will be rejected in case any error occurred including:
            // - permission is not given on the OS level (macOS).
            $("#monitorShares option[value='0']").prop('selected', true);
            console.error("SelectLocalMonitor Failed:", error);
        });
    };


    StartWindowShare();
    StartMonitorShare();

    function StartWindowShare() {
        // Register for window share status updates, which operates differently in plugin vs webrtc:
        //    plugin: onAdded and onRemoved callbacks are received for each available window
        //    webrtc: a popup is displayed (an extension to Firefox/Chrome) which allows the user to
        //            select a share; once selected, that share will trigger an onAdded event
        vidyoConnector.RegisterLocalWindowShareEventListener({
            onAdded: function (localWindowShare) {
                // New share is available so add it to the windowShares array and the drop-down list
                if (localWindowShare.name != "") {
                    var shareVal;
                    if (localWindowShare.applicationName) {
                        shareVal = localWindowShare.applicationName + " : " + localWindowShare.name;
                    } else {
                        shareVal = localWindowShare.name;
                    }
                    if (isSafari) {
                        let button = document.createElement('button');
                        button.innerHTML = shareVal;
                        button.id = localWindowShare.id;
                        button.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectLocalShare(localWindowShare);
                        };
                        $("#windowSharesSafari").append(button);
                    } else {
                        $("#windowShares").append("<option value='" + window.btoa(localWindowShare.id) + "'>" + shareVal + "</option>");
                    }
                    windowShares[window.btoa(localWindowShare.id)] = localWindowShare;
                    console.log("Window share added, name : " + localWindowShare.name + " | id : " + window.btoa(localWindowShare.id));
                }
            },
            onRemoved: function (localWindowShare) {
                // Existing share became unavailable
                if (isSafari) {
                    $("#" + localWindowShare.id).remove();
                } else {
                    $("#windowShares option[value='" + window.btoa(localWindowShare.id) + "']").remove();
                }
                delete windowShares[window.btoa(localWindowShare.id)];
            },
            onSelected: function (localWindowShare) {
                // Share was selected/unselected by you or automatically
                if (localWindowShare) {
                    if (!isSafari) {
                        $("#windowShares option[value='" + window.btoa(localWindowShare.id) + "']").prop('selected', true);
                    }
                    isSharingWindow = true;
                    console.log("Window share selected : " + localWindowShare.name);
                } else {
                    if (!isSafari) {
                        $("#windowShares option[value='0']").prop('selected', true);
                    }
                    isSharingWindow = false;
                }
            },
            onStateUpdated: function (localWindowShare, state) {
                // localWindowShare state was updated
            }
        }).then(function () {
            console.log("RegisterLocalWindowShareEventListener Success");
        }).catch(function () {
            console.error("RegisterLocalWindowShareEventListener Failed");
        });
    }

    function StartMonitorShare() {
        // Register for monitor share status updates
        vidyoConnector.RegisterLocalMonitorEventListener({
            onAdded: function (localMonitorShare) {
                // New share is available so add it to the monitorShares array and the drop-down list
                if (localMonitorShare.name != "") {
                    if (isSafari) {
                        let button = document.createElement('button');
                        button.innerHTML = localMonitorShare.name;
                        button.id = localMonitorShare.id;
                        button.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectLocalMonitor(localMonitorShare);
                        };
                        $("#monitorSharesSafari").append(button);
                    } else {
                        $("#monitorShares").append("<option value='" + window.btoa(localMonitorShare.id) + "'>" + localMonitorShare.name + "</option>");
                    }
                    monitorShares[window.btoa(localMonitorShare.id)] = localMonitorShare;
                    console.log("Monitor share added, name : " + localMonitorShare.name + " | id : " + window.btoa(localMonitorShare.id));
                }
            },
            onRemoved: function (localMonitorShare) {
                if (isSafari) {
                    $("#" + localMonitorShare.id).remove();
                } else {
                    // Existing share became unavailable
                    $("#monitorShares option[value='" + window.btoa(localMonitorShare.id) + "']").remove();
                }
                delete monitorShares[window.btoa(localMonitorShare.id)];
            },
            onSelected: function (localMonitorShare) {
                // Share was selected/unselected by you or automatically
                if (localMonitorShare) {
                    if (!isSafari) {
                        $("#monitorShares option[value='" + window.btoa(localMonitorShare.id) + "']").prop('selected', true);
                    }
                    console.log("Monitor share selected : " + localMonitorShare.name);
                    isSharingMonitor = true;
                } else {
                    if (!isSafari) {
                        $("#monitorShares option[value='0']").prop('selected', true);
                    }
                    isSharingMonitor = false;
                }
            },
            onStateUpdated: function (localMonitorShare, state) {
                // localMonitorShare state was updated
            }
        }).then(function () {
            console.log("RegisterLocalMonitorShareEventListener Success");
        }).catch(function () {
            console.error("RegisterLocalMonitorShareEventListener Failed");
        });
    }

    if (isSafari) {
        $("#monitorSharesButtonNone").click((e) => {
            e.stopPropagation();
            e.preventDefault();
            selectLocalMonitor(null);
        });
        $("#windowSharesButtonNone").click((e) => {
            e.stopPropagation();
            e.preventDefault();
            selectLocalShare(null);
        });
    } else {
        // A monitor was selected from the "Monitor Share" drop-down list (plugin mode only).
        $("#monitorShares").change(function () {
            console.log("*** Monitor shares change called");

            // Find the share selected from the drop-down list
            $("#monitorShares option:selected").each(function () {
                share = monitorShares[$(this).val()];
                selectLocalMonitor(share);
            });
        });
        // A window was selected from the "Window Share" drop-down list.
        // Note: in webrtc mode, this is only called for the "None" option (to stop the share) since
        //       the share is selected in the onAdded callback of the LocalWindowShareEventListener.
        $("#windowShares").change(function () {
            console.log("*** Window shares change called");

            // Find the share selected from the drop-down list
            $("#windowShares option:selected").each(function () {
                share = windowShares[$(this).val()];
                selectLocalShare(share);
            });
        });
    }
}

function getParticipantName(participant, cb) {
    if (!participant) {
        cb("Undefined");
        return;
    }

    if (participant.name) {
        cb(participant.name);
        return;
    }

    participant.GetName().then(function (name) {
        cb(name);
    }).catch(function () {
        cb("GetNameFailed");
    });
}

function handleParticipantChange(vidyoConnector, rendererSlots, remoteCameras) {

    var t = vidyoConnector.ReportLocalParticipantOnJoined({
        reportLocalParticipant: true
    }).then(() => {
        vidyoConnector.RegisterParticipantEventListener({
            onJoined: function (participant) {
                getParticipantName(participant, function (name) {
                    $("#participantStatus").html("" + name + " Joined");
                    console.log("Participant onJoined: " + name);
                });
            },
            onLeft: function (participant) {
                getParticipantName(participant, function (name) {
                    $("#participantStatus").html("" + name + " Left");
                    console.log("Participant onLeft: " + name);
                });
            },
            onDynamicChanged: function (participants, cameras) {
                // Order of participants changed
            },
            onLoudestChanged: function (participant, audioOnly) {
                getParticipantName(participant, function (name) {
                    $("#participantStatus").html("" + name + " Speaking");
                });

                // Check if the loudest speaker is being rendered in one of the slots
                var found = false;
                for (var i = 1; i < rendererSlots.length; i++) {
                    if (rendererSlots[i] === participant.id) {
                        found = true;
                        break;
                    }
                }
                console.log("onLoudestChanged: loudest speaker in rendererSlots? " + found);

                // First check if the participant's camera has been added to the remoteCameras dictionary
                if (!(participant.id in remoteCameras)) {
                    console.log("Warning: loudest speaker participant does not have a camera in remoteCameras");
                }
                // If the loudest speaker is not being rendered in one of the slots then
                // hide the slot 1 remote camera and assign loudest speaker to slot 1.
                else if (!found) {
                    // Set the isRendered flag to false of the remote camera which is being hidden
                    remoteCameras[rendererSlots[1]].isRendered = false;

                    // Assign slot 1 to the the loudest speaker's participant id
                    rendererSlots[1] = participant.id;

                    // Set the isRendered flag to true of the remote camera which has now been rendered
                    remoteCameras[participant.id].isRendered = true;

                    //Hiding the view first, before the AssignViewToRemoteCamera
                    vidyoConnector.HideView({ viewId: "renderer1" }).then(function () {
                        console.log("HideView Success");
                        vidyoConnector.AssignViewToRemoteCamera({
                            viewId: "renderer1",
                            remoteCamera: remoteCameras[participant.id].camera,
                            displayCropped: true,
                            allowZoom: false
                        }).then(function (retValue) {
                            console.log("AssignViewToRemoteCamera " + participant.id + " to slot 1" + " = " + retValue);
                            ShowRenderer(vidyoConnector, "renderer1");
                        }).catch(function () {
                            console.log("AssignViewToRemoteCamera Failed");
                            rendererSlots[1] = OPEN_REMOTE_SLOT;
                            remoteCameras[participant.id].isRendered = false;
                        });
                    }).catch(function (e) {
                        console.log("HideView Failed, loudest speaker not assigned");
                    });
                }
            }
        }).then(function () {
            console.log("RegisterParticipantEventListener Success");
        }).catch(function () {
            console.err("RegisterParticipantEventListener Failed");
        });
    });
}

function parseUrlParameters(configParams) {
    // Fill in the form parameters from the URI
    var host = getUrlParameterByName("host");
    if (host)
        $("#host").val(host);
    var token = getUrlParameterByName("token");
    if (token)
        $("#token").val(token);
    var roomKey = getUrlParameterByName("roomKey");
    if (roomKey)
        $("#roomKey").val(roomKey);
    var roomPin = getUrlParameterByName("roomPin");
    if (roomPin)
        $("#roomPin").val(roomPin);
    var displayName = getUrlParameterByName("displayName");
    if (displayName)
        $("#displayName").val(displayName);
    var resourceId = getUrlParameterByName("resourceId");
    if (resourceId)
        $("#resourceId").val(resourceId);
    const extData = getUrlParameterByName("extData");
    if (extData)
        $("#extData").val(extData);
    const extDataType = getUrlParameterByName("extDataType");
    if (extDataType)
        $("#extDataType").val(extDataType);
    configParams.autoJoin = getUrlParameterByName("autoJoin");
    configParams.enableDebug = getUrlParameterByName("enableDebug");
    configParams.hideConfig = getUrlParameterByName("hideConfig");

    var showAdvancedSettings = getUrlParameterByName("showAdvancedSettings");

    if (showAdvancedSettings === 'true') {
        $("#advancedSettings").removeClass("hiddenPermanent");
        initLogModal();
    }

    // If the parameters are passed in the URI, do not display options dialog,
    // and automatically connect.
    if (host && token && displayName && resourceId) {
        $("#optionsParameters").addClass("optionsHidePermanent");
    }

    if (configParams.hideConfig == "1") {
        updateRenderers(true);
    }

    return;
}

function showRenderers() {
    ShowRenderer(vidyoConnector, "renderer0");
    ShowRenderer(vidyoConnector, "renderer1");
    ShowRenderer(vidyoConnector, "renderer2");
    ShowRenderer(vidyoConnector, "renderer3");
    ShowRenderer(vidyoConnector, "renderer4");
    ShowRenderer(vidyoConnector, "renderer5");
}

function updateRenderers(fullscreen) {
    if (fullscreen) {
        $("body").addClass("options-hidden in-call");
    } else {
        $("body").removeClass("options-hidden in-call");
    }

    showRenderers();
}

// Attempt to connect to the conference
// We will also handle connection failures
// and network or server-initiated disconnects.
function connectToConference(vidyoConnector, rendererSlots, remoteCameras, configParams) {
    // Abort the Connect call if resourceId is invalid. It cannot contain empty spaces or "@".
    if ($("#resourceId").val().indexOf(" ") != -1 || $("#resourceId").val().indexOf("@") != -1) {
        console.error("Connect call aborted due to invalid Resource ID");
        connectorDisconnected(rendererSlots, remoteCameras, "Disconnected", "");
        $("#error").html("<h3>Failed due to invalid Resource ID" + "</h3>");
        return;
    }

    // Clear messages
    $("#error").html("");
    $("#message").html("<h3 class='blink'>CONNECTING...</h3>");

    const loggerUrl = $("#loggerURL").val();
    const extData = $("#extData").val();
    const extDataType = $("#extDataType").val();

    vidyoConnector.SetAdvancedConfiguration({
        loggerURL: loggerUrl,
        extData,
        extDataType,
    });

    vidyoConnector.ConnectToRoomAsGuest({
        // Take input from options form
        host: $("#host").val(),
        roomKey: $("#roomKey").val(),
        displayName: $("#displayName").val(),
        roomPin: $("#roomPin").val(),

        // Define handlers for connection events.
        onSuccess: function () {
            console.log("vidyoConnector.Connect : onSuccess callback received");
            $("#connectionStatus").html("Connected");

            if (configParams.hideConfig != "1") {
                updateRenderers(true);
            }
            $("#message").html("");
        },
        onFailure: function (reason) {
            // Failed
            console.error("vidyoConnector.Connect : onFailure callback received");
            connectorDisconnected(rendererSlots, remoteCameras, "Failed", "");
            $("#error").html("<h3>Call Failed: " + reason + "</h3>");
        },
        onDisconnected: function (reason) {
            // Disconnected
            console.log("vidyoConnector.Connect : onDisconnected callback received");
            connectorDisconnected(rendererSlots, remoteCameras, "Disconnected", "Call Disconnected: " + reason);

            if (configParams.hideConfig != "1") {
                updateRenderers(false);
            }
        }
    }).then(function (status) {
        if (status) {
            console.log("Connect Success");
        } else {
            console.error("Connect Failed");
            connectorDisconnected(rendererSlots, remoteCameras, "Failed", "");
            $("#error").html("<h3>Call Failed" + "</h3>");
        }
    }).catch(function () {
        console.error("Connect Failed");
        connectorDisconnected(rendererSlots, remoteCameras, "Failed", "");
        $("#error").html("<h3>Call Failed" + "</h3>");
    });
}

// Connector either fails to connect or a disconnect completed, update UI
// elements and clear rendererSlots and remoteCameras.
function connectorDisconnected(rendererSlots, remoteCameras, connectionStatus, message) {
    $("#connectionStatus").html(connectionStatus);
    $("#message").html(message);
    $("#participantStatus").html("");
    $("#joinLeaveButton").removeClass("callEnd").addClass("callStart");
    $('#joinLeaveButton').prop('title', 'Join Conference');

    // Clear rendererSlots and remoteCameras when not connected in case not cleared
    // in RegisterRemoteCameraEventListener onRemoved.
    for (var i = 1; i < rendererSlots.length; i++) {
        if (rendererSlots[i] != OPEN_REMOTE_SLOT) {
            rendererSlots[i] = OPEN_REMOTE_SLOT;
            console.log("Calling HideView on renderer" + i);
            vidyoConnector.HideView({ viewId: "renderer" + (i) }).then(function () {
                console.log("HideView Success");
            }).catch(function (e) {
                console.log("HideView Failed");
            });
        }
    }
    remoteCameras = {};
}

// Extract the desired parameter from the browser's location bar
function getUrlParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function initLogModal() {
    var modal = document.getElementById('log-popup');
    var span = document.getElementsByClassName("close")[0];
    $('#showLogs').click(function () {
        modal.style.display = "block";
    });
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
    span.onclick = function () {
        modal.style.display = "none";
    };
}

function createTable(data) {
    let logLevelsName = Object.keys(data.logLevel);
    let logCategory = data.logCategory;
    let levels = $("#levels");
    let table = $("#log-table");
    $("#enable-all").change(handleLogCategoryChanged.bind(this));
    $.each(logLevelsName, function (i) {
        let th = $('<th/>')
            .appendTo(levels);
        let levelLable = $('<label/>')
            .addClass("container")
            .appendTo(th);
        let levelCheckbox = $('<input />', { type: 'checkbox', value: logLevelsName[i] + '@*' })
            .addClass("log-check level")
            .attr('id', 'all-' + logLevelsName[i])
            .appendTo(levelLable);
        $('<span/>')
            .addClass('checkmark')
            .appendTo(levelLable);
        $('<p/>')
            .text(logLevelsName[i])
            .appendTo(th)
        levelCheckbox.change(handleLogCategoryChanged.bind(this))
    });
    $.each(logCategory, function (i) {
        let tr = $('<tr/>')
            .addClass(logCategory[i])
            .appendTo(table);
        let categoryNameCell = $('<td/>')
            .appendTo(tr);
        let categoryLabel = $('<label/>')
            .addClass("container")
            .appendTo(categoryNameCell);
        let categoryCheckbox = $('<input />', { type: 'checkbox', value: 'all@' + logCategory[i] })
            .addClass("log-check")
            .attr('id', 'all-' + logCategory[i])
            .appendTo(categoryLabel);
        $('<span/>')
            .addClass('checkmark')
            .appendTo(categoryLabel);
        $('<span/>')
            .text(logCategory[i])
            .appendTo(categoryNameCell)
        categoryCheckbox.change(handleLogCategoryChanged.bind(this))
        $.each(logLevelsName, function (k) {
            let logCell = $('<td/>')
                .appendTo(tr);
            let logLabel = $('<label/>')
                .addClass("container")
                .appendTo(logCell);
            let logCheckbox = $('<input />', { type: 'checkbox', value: logLevelsName[k] + '@' + logCategory[i] })
                .addClass("log-check")
                .addClass(logLevelsName[k])
                .attr('id', logLevelsName[k] + '-' + logCategory[i])
                .appendTo(logLabel);
            $('<span/>')
                .addClass('checkmark')
                .appendTo(logLabel);
            logCheckbox.change(handleLogCategoryChanged.bind(this));
        })
    });
    if (getUrlParameterByName('enableDebug') === '1') {
        vidyoConnector.SetAdvancedConfiguration({ addLogCategory: 'all' });
    }
}

function setActiveLogLevels(activeLogs, logLevels) {
    let i = 0;
    let prevLogs = {};
    return function () {
        for (let activeLog in activeLogs) {
            if (activeLogs.hasOwnProperty(activeLog)) {
                if (activeLogs[activeLog] === prevLogs[activeLog]) continue;
                for (let level in logLevels) {
                    if (activeLogs[activeLog] & logLevels[level]) {
                        $(`#${level}-${activeLog}`).prop("checked", true);
                        i++;
                        if (i === Object.keys(logLevels).length) {
                            $(`#all-${activeLog}`).prop("checked", true);
                            i = 0;
                            checkLevelCheckbox(level)
                        } else {
                            $(`#all-${activeLog}`).prop("checked", false);
                            checkLevelCheckbox(level);
                        }
                    } else {
                        $(`#${level}-${activeLog}`).prop("checked", false);
                        $(`#all-${activeLog}`).prop("checked", false);
                        checkLevelCheckbox(level);
                    }
                }
                i = 0;
            }
        }
        prevLogs = Object.assign({}, activeLogs);
    }
}

function handleLogCategoryChanged(val) {
    let onOff = $(val.target).prop('checked');
    vidyoConnector.SetAdvancedConfiguration({ addLogCategory: (!onOff) ? '-' + $(val.target).val() : $(val.target).val() });
}

function checkLevelCheckbox(level) {
    let length = $(`.${level}:checked`).length == $(`.${level}`).length;
    if (length) {
        $(`#all-${level}`).prop("checked", true);
    } else {
        $(`#all-${level}`).prop("checked", false);
    }
    let enableAllLogs = $(`.level:checked`).length == $(`.level`).length;
    if (enableAllLogs) {
        $(`#enable-all`).prop('checked', true);
    } else {
        $(`#enable-all`).prop('checked', false);
    }
}


function handleRemoteSharing() {
    vidyoConnector.RegisterRemoteWindowShareEventListener({
        //new remote share is added (remote user started sharing)
        onAdded: function (remoteShare) {
            //only for test purposes
            globalRemoteShare = remoteShare
            last_pos = 3;
            //Hiding the view first, before the AssignViewToRemoteCamera to avoid leaks
            vidyoConnector.HideView({ viewId: "renderer3" }).then(function () {
                console.log("HideView Success");
                //start render remote share in div block with id renderer3
                vidyoConnector.AssignViewToRemoteWindowShare({
                    viewId: "renderer3",
                    remoteWindowShare: remoteShare,
                    displayCropped: true,
                    allowZoom: false
                }).then(function (retValue) {
                    console.log("AssignViewToRemoteWindowShare " + remoteShare + " to slot 3" + " = " + retValue);
                    ShowRenderer(vidyoConnector, "renderer3");
                }).catch(function () {
                    console.log("AssignViewToRemoteWindowShare Failed");
                });
            }).catch(function (e) {
                console.log("HideView Failed, loudest speaker not assigned");
            });
        },
        onRemoved: function (remoteWindowShare) {
            //stub
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