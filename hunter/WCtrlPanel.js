class WCtrlPanel{
  /**
   * @param vidyoConnector
   * @returns {Promise<WCtrlPanel>}
   */
  static createWCtrlPanel(vidyoConnector){
    /** @type {WCtrlPanel} */
    WCtrlPanel.instance = new WCtrlPanel(vidyoConnector);
    return WCtrlPanel.instance.loadWCtrlPanel();
  }

  /**
   * @param vidyoConnector
   */
  constructor(vidyoConnector) {
    this.vidyoConnector = vidyoConnector;
    /** @type {HTMLElement} */
    this.ctrlPanelElm = null;
    /** @type {HTMLSelectElement} */
    this.sel16x9 = null;
    /** @type {HTMLSelectElement} */
    this.sel4x3 = null;
    /** @type {HTMLSelectElement} */
    this.selFPS = null;
    /** @type {HTMLElement} */
    this.closeButton = null;
  }

  /**
   * @returns {Promise<WCtrlPanel>}
   */
  loadWCtrlPanel(){
    let promise = new Promise( (resolve, reject) => {
      /** @type {XMLHttpRequest} */
      let xReq = new XMLHttpRequest();

      // xReq.addEventListener('progress', () => {});
      xReq.addEventListener('load', () => {
        this.onLoad(xReq);
        resolve(this);
      });
      xReq.addEventListener('error', () => {
        this.onError(xReq);
        reject('error');
      });
      // xReq.addEventListener('abort', () => {});

      xReq.open('GET', './WCtrlPanel.html');
      xReq.send();
    });
    return promise;
  }

  /**
   * @param {XMLHttpRequest} xReq
   */
  onLoad(xReq){
//    console.log(xReq.response);
    let parser=new DOMParser();
    /** @type {Document}  */
    let htmlDoc=parser.parseFromString(xReq.response, "text/html");
    let ctrlPanelElm = htmlDoc.querySelector('#webrtc_ctrl_panel');
    /** @type {HTMLElement} */
    this.ctrlPanelElm = document.adoptNode(ctrlPanelElm);
    this.setupUI();
    document.body.appendChild(ctrlPanelElm);
  }
  /**
   * @param {XMLHttpRequest} xReq
   */
  onError(xReq){
    console.error(xReq.response);
  }

  setupUI() {
    this.sel16x9 = this.ctrlPanelElm.querySelector('#std_resolutions_16x9');
    this.sel16x9.onchange = /** @param {Event} event */ (event) => { this.applyNewResolution(event.srcElement); };
    this.sel4x3 = this.ctrlPanelElm.querySelector('#std_resolutions_4x3');
    this.sel4x3.onchange = /** @param {Event} event */ (event) => { this.applyNewResolution(event.srcElement); };

    this.closeButton = this.ctrlPanelElm.querySelector('#webrtc_ctrl_panel_close');
    this.closeButton.onclick = /** @param {Event} event */ (event) => { this.showPanel(event.srcElement); };
  }

  /**
   * @param {HTMLSelectElement} selectElm
   */
  applyNewResolution(selElm){
    console.log('new resolution value = ' + selElm.value);
    if(selElm.value === 'none'){
      return;
    }
    if(selElm.value === 'unlocked'){
      this.unlockConstraints();
      return;
    }
    let nc = selElm.value.split('x');
    let mediaTrackConstraintSet = {
      // aspectRatio?: number | ConstrainDoubleRange;
      // deviceId?: string | string[] | ConstrainDOMStringParameters;
      // echoCancelation?: boolean | ConstrainBooleanParameters;
      // facingMode?: string | string[] | ConstrainDOMStringParameters;
      // frameRate?: number | ConstrainDoubleRange;
      // groupId?: string | string[] | ConstrainDOMStringParameters;
      height: parseInt(nc[1], 10),
      // sampleRate?: number | ConstrainLongRange;
      // sampleSize?: number | ConstrainLongRange;
      // volume?: number | ConstrainDoubleRange;
      width: parseInt(nc[0], 10)
    };
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLockConstraints(false);
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._constraintsMap.Camera.maxConstraints = undefined;
    Object.assign(this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._constraintsMap.Camera.constraints, mediaTrackConstraintSet);
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoTransmittedStreamConstraintsChanged();
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLockConstraints(true);
  }
  /**
   * @param {HTMLSelectElement} selectElm
   */
  applyNewFPS(selElm){
    console.log('new FPS value = ' + selElm.value);
    if(selElm.value === 'none'){
      return;
    }
    if(selElm.value === 'unlocked'){
      this.unlockConstraints();
      return;
    }
    let mediaTrackConstraintSet = {
      // aspectRatio?: number | ConstrainDoubleRange;
      // deviceId?: string | string[] | ConstrainDOMStringParameters;
      // echoCancelation?: boolean | ConstrainBooleanParameters;
      // facingMode?: string | string[] | ConstrainDOMStringParameters;
      frameRate: parseInt(selElm.value, 10)
      // groupId?: string | string[] | ConstrainDOMStringParameters;
      // height: parseInt(nc[1], 10),
      // sampleRate?: number | ConstrainLongRange;
      // sampleSize?: number | ConstrainLongRange;
      // volume?: number | ConstrainDoubleRange;
      // width: parseInt(nc[0], 10)
    };
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLockConstraints(false);
    // this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLocalStreamConstraintsChanged(mediaTrackConstraintSet, true);
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoTransmittedStreamConstraintsChanged(mediaTrackConstraintSet, true);
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLockConstraints(true);
  }
  /**
   * @param {HTMLSelectElement} selectElm
   */
  applyNewBandwidth(selElm){
    console.log('new Bandwidth value = ' + selElm.value);
    if(selElm.value === 'none'){
      return;
    }
    if(selElm.value === 'unlocked'){
      this.vidyoConnector._hidden.VidyoSimple._vidyoCore.XmppProvider.LockLocalBandwidthLimit(false);
      return;
    }
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.XmppProvider.LockLocalBandwidthLimit(false);
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.XmppProvider.ApplyLocalBandwidthLimit(parseInt(selElm.value, 10));
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.XmppProvider.LockLocalBandwidthLimit(true);
  }

  showPanel(){
    if(this.ctrlPanelElm.classList.contains("hiddenPanel")) {
      this.ctrlPanelElm.classList.remove("hiddenPanel");
    } else {
      this.ctrlPanelElm.classList.add("hiddenPanel");
    }
  }

  unlockConstraints(){
    this.vidyoConnector._hidden.VidyoSimple._vidyoCore.Controllers.LocalStreamController._videoLockConstraints(false);
    this.sel16x9.value = 'unlocked';
    this.sel4x3.value = 'none';
    this.selFPS.value = 'unlocked';
  }
}
