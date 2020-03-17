import React, { Component } from 'react';
import { Text, TouchableOpacity, View, YellowBox, Dimensions, TextInput, Button } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';
import io from 'socket.io-client';
import { button, container, rtcView, text } from './styles';
import { values } from 'lodash';

//const url = 'https://tico-webrtc-signal-server.herokuapp.com';
const url ='https://09f5c710.ngrok.io/';
const { width, height } = Dimensions.get('window')

YellowBox.ignoreWarnings(['Setting a timer', 'Unrecognized WebSocket connection', 'ListView is deprecated and will be removed']);

/* ==============================
 Global variables
 ================================ */
const configuration = {
  iceServers: [
    {
      url: 'turn:numb.viagenie.ca',
      username: 'nhatlinhpt2015@gmail.com',
      credential: 'anhlinh1',
    },
     {
      'urls': 'stun:stun.l.google.com:19302',
    }
    ,
     {
      'urls': 'stun:stun.xten.com',
    }
  ],
};

let localStream;

/* ==============================
 Class
 ================================ */
class App extends Component {
  constructor(props) {
    super(props);
    this.pcPeers = {};
    this.socket = io.connect(url, { transports: ['websocket'] });
    this.state = {
      uid:0,
      socketuid:"",
      localStream: '',
      remoteList: [],
      remoteCamera: 1,//on:1 ,off :0
      localCamera: 1,  //on:1 ,off :0
      stateMicrophone: true,
      callfrom:''
    };
  }

  componentDidMount() {
    let uid=(Math.floor((Math.random() * 100) + 1));
    this.setState({
      uid:uid
    })
    this.getLocalStream();
    this.socket.on('connect',()=>{
      console.log(this.socket.id);
      this.setState({
        socketuid:this.socket.id
      })
    })
    this.socket.on('leave', () => {
      this.leave();
    });
    this.socket.on('exchange', data => {
      this.exchange(data);
    });
    this.socket.on('turnOffCamera', param => {
      this.setState({ remoteCamera: param });
    });
  }
  // sendOffer=(uid,fid)=>{
  //   this.socket.emit('sendOffer',uid,fid);
  // };
  getLocalStream = () => {
    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (sourceInfo.kind === 'videoinput' && sourceInfo.facing === ('front')) {
          videoSourceId = sourceInfo.deviceId;
        }
      }
      mediaDevices.getUserMedia({
        //this function also request camera and audio permissions
        audio: true,
        video: {
          mandatory: {
            minWidth: 640,
            minHeight: 360,
            minFrameRate: 30,
          },
          facingMode: ('user'),
          optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
        },
      })
        .then(async stream => {
          //this.join('abc');
          this.localStream = stream;
          this.setState({
            localStream: stream,
            streamURL: stream.toURL(),
          });
        })
        .catch(error => {
          console.log('error>>>', error);
        });
    });
  };
  switchCamera = () => {
    const { localStream } = this.state;
    localStream.getVideoTracks().forEach(track => {
      track._switchCamera();
    });
  };

  exchange = data => {
    const fromId = data.from;
    let pc;
    if (fromId in this.pcPeers) {
      pc = this.pcPeers[fromId];
    } else {
      pc = this.createPC(fromId, false);
    }
    
    if (data.sdp) {
      let sdp = new RTCSessionDescription(data.sdp);
      console.log('data.spd',data.sdp);
      pc.setRemoteDescription(sdp).then(
        () => pc.remoteDescription.type === 'offer' ?
          pc.createAnswer().then(
            desc => pc.setLocalDescription(desc)
            .then(() => this.socket.emit('exchange', { to: fromId, sdp: pc.localDescription }),)):null);
    } else {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  };
  onPress = () => {
    //let roomID=Math.floor((Math.random() * 100) + 1);
    this.join('linh2');
  };
  //hang off the phone
  hangOff = () => {
    this.socket.emit('declineCalling', 'linh2');
  };
  button = (func, text) => (
    <TouchableOpacity style={button.container} onPress={func}>
      <Text style={button.style}>{text}</Text>
    </TouchableOpacity>
  );
  join = roomID => {
    let callback = socketIds => {
      Object.keys(socketIds).forEach(index => {
        this.createPC(socketIds[index], true);
      });
    };
    this.socket.emit('join', roomID, callback);
  };
  
  leave = () => {
    values(this.pcPeers).forEach(pcPeer => {
      pcPeer.close();
    });
    this.setState({
      remoteList: {},
    });
  };
  waitForResponse=()=>{

  };
  //tao moi connection
  createPC = (socketId, isOffer) => {
    const peer = new RTCPeerConnection(configuration);
    console.log('peer',peer);
    this.pcPeers = {
      ...this.pcPeers,
      [socketId]: peer,
    };
    peer.addStream(this.state.localStream);

    peer.onicecandidate = event => {
      console.log('event candidate',event.candidate);
      if (event.candidate) {
        this.socket.emit('exchange', { to: socketId, candidate: event.candidate });
      }
    };

    peer.onnegotiationneeded = () => {
      if (isOffer) {
        createOffer();
      }
    };
    peer.onsignalingstatechange = async event => {
      // when the signal state become stable record the data and stop ringback

      if (event.target.signalingState === 'stable') {
        if (Platform.OS === 'ios') {
          this.localStream.getVideoTracks().forEach(track => {
            //For ios to trigger the camera on
           // track._switchCamera(//
            track._switchCamera();
          })
        }
      }
    };

    peer.onaddstream = event => {
      const remoteList = this.state.remoteList;
      console.log('remote list',remoteList);
      remoteList[socketId] = event.stream;
      this.setState({ remoteList });
    };
    
    const createOffer = () => {
      peer.createOffer().then(desc => {
        console.log('desc',desc);
        peer.setLocalDescription(desc).then(() => {
          this.socket.emit('exchange', { to: socketId, sdp: peer.localDescription });
        });
      });
    };
    return peer;
  };

  render() {
    const { streamURL } = this.state;
    const remoteList = values(this.state.remoteList);

    return (
      <View style={container.style}>
        <TextInput placeholder="UserName" onChangeText={uid=>this.setState({uid:uid})}></TextInput>
        {this.button(this.onPress, 'Enter room')}
        {this.button(this.hangOff, 'hang off')}
        {this.button(this.switchCamera, 'Change Camera')}
         <Text>{this.state.uid}</Text>
        <RTCView streamURL={streamURL} style={rtcView.style}/>
        {
          remoteList.length > 0 &&
          <RTCView
            style={rtcView.style}
            objectFit={'cover'}
            key={`Remote_RTCView`}
            streamURL={remoteList[0].toURL()}
          />
        }
      </View>
    );
  }
}


export default App;
