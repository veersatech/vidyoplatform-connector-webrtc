# VidyoPlatform Connector native WebRTC

Current version: 21.3.0.0034

Host: https://vidyoplatform-webrtc.web.app

## Update Flow:

1. Grab latest version from build runner: https://vidyo-bamboo.edge.local/browse/NWEBRTC. Find it under "Artifacts". Example: VidyoClient-NWebRTCH-21.3.0.0034.zip. 
2. Unzip and copy **content** of "VidyoClient-NWebRTCH-21.3.0.0034/hunter" folder to "vidyoplatform-connector-webrtc/public" folder. Here we copy the sample stuff.
3. Now replace folder "VidyoClient-NWebRTCH-21.3.0.0034/latest_build" inside "VidyoClient-NWebRTCH-21.3.0.0034/public". That will update the library.
4. Commit and push the changes.

Sample is hosted at:
https://vidyoplatform-webrtc.web.app
via Firebase hosting.

They will apply automatically with Github deploy job listed here:
https://github.com/tmelko-vidyo/vidyoplatform-connector-webrtc/actions
