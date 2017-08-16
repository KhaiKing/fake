// const socket = io("https://web-rtc-001.herokuapp.com/");
const socket = io("http://localhost:8888");

var peer = new Peer({
  key: 'kv7pis9v4n3o9a4i'
});
var peerId, fullname;
peer.on("open", function(id) {
  peerId = id;
})

function playPeer(call){
  showLive();
  playLocal(localStream);
  call.answer(localStream);
  call.on("stream", function(remoteStream) {
    playRemote(remoteStream, call.peer);
  })
}

peer.on("call", function(call) {
  if (login) {
    if (localStream !== undefined) {
      playPeer(call);
    } else {
      console.log("Local Stream closed");
      openStream().then(function(stream) {
        localStream = stream;
        playPeer(call);
      })
    }
  }
})

var login = false;
var localStream;

//Server
socket.on("NEW_LEAVE", function(response){
  console.log("NEW_LEAVE");
  $(".remote-video[data-peer=" + response.peerId + "]").remove();
  $(".user-login[data-username=" + response.username + "]").remove();
  if(username.value != response.username) {
    renderLogin($(".user-list"), response);
  }
  if(response.newHost !== undefined) {
    $(".user-login[data-username=" + response.newHost.username + "]").remove();
    renderLogin($(".user-list"),response.newHost);
  }
  arrangeVideo();
})

// socket.on("LEAVE_ROOM", function(response) {
//   $(".remote-video[data-peer=" + response.peerId + "]").remove();
//   arrangeVideo();
//   if (response.newHost !== undefined) {
//     //change host
//     alert("Host Change");
//   }
//
// })

socket.on("NEW_JOIN", function(response) {
  $(".user-list > div[data-username=" + response + "]").remove();
})

socket.on("NEW_GROUP", function(response) {
  if(username.value != response.host.username) {
    console.log(response);
     $(".user-list > div[data-username=" + response.host.username + "]").remove();
     $(".user-list > div[data-username=" + response.client.username + "]").remove();
     renderLogin($(".user-list"), response.host);
  }
})

socket.on("JOIN_REQUEST", function(response) {
  console.log("JOIN_REQUEST");
  var result = confirm(response.fullname + " want to join with you?");
  socket.emit("JOIN_RESPONSE", {
    username: response.username,
    agree: result
  });
})

socket.on("JOIN_RESPONSE", function(response) {
  if (response.success) {
    let call = peer.call(response.result, localStream, {
      metadata: {
        requestKey: fullname
      }
    });
    call.on("stream", function(remoteStream) {
      playRemote(remoteStream, call.peer);
    });
  } else {
    alert(response.message);
  }
});


socket.on("CALL_REQUEST", function(response) {
  console.log("CALL_REQUEST");
  var result = confirm(response.fullname + " want to call you?");

  socket.emit("CALL_RESPONSE", {
    username: response.username,
    agree: result
  });
})

socket.on("CALL_RESPONSE", function(response) {
  console.log("CALL_RESPONSE");
  if (response.success) {
    openStream().then(function(stream) {
      showLive();
      localStream = stream;
      playLocal(localStream);

      let call = peer.call(response.peerId, localStream, {
        metadata: {
          requestKey: fullname
        }
      });
      call.on("stream", function(remoteStream) {
        playRemote(remoteStream, call.peer);
      });
    })
  } else {
    alert(response.message);
  }
})

socket.on("GET_FULL_NAME", function(response) {
  $(response.selector).text(response.fullname);
})

socket.on("NEW_LOGOUT", function(response) {
  console.log("NEW LOGOUT");
  $(".user-login[data-username=" + response.username + "]").animate({
    marginLeft: -50,
    opacity: 0
  }, 300, function() {
    $(this).remove();
  });

  $(".remote-video[data-peer=" + response.peerId + "]").remove();
  arrangeVideo();
})

socket.on("LOGOUT", function(duplicate) {
  logout();
  if (duplicate) {
    alert("Duplicate login. You was logout.");
  }
})

socket.on("NEW_LOGIN", function(response) {
  if (login) {
    console.log("NEW LOGIN");
    renderLogin($(".user-list"), response);
  }
})

socket.on("LOGIN_RESULT", function(response) {
  console.log("LOGIN RESULT");
  if (response.success) {
    fullname = response.fullname;
    $("#lblFullName").text(fullname);
    showLoged();
    let divList = $(".user-list");
    response.result.forEach(function(item) {
      renderLogin(divList, item);
    })
  } else {
    login = false;
    alert("Login failed");
  }
})

const MEMBER_TYPE = {
  HOST_MEMBER: 1,
  CLIENT_MEMBER: 0,
  FREE_MEMBER: -1 // || undefined
}

//UI
function arrangeVideo() {
  let count = $(".live-video").length;
  let s = window.innerWidth * window.innerHeight;
  let unit = s / count;
  let x = Math.sqrt(unit);

  let round = Math.floor(window.innerWidth / x);

  let width = Math.floor(window.innerWidth / round);
  let height = Math.floor(unit / width);
  let y = Math.floor(window.innerHeight / Math.ceil(count / round));
  if (height > y) {
    height = y;
  }

  $(".live-video").each(function(index) {
    $(this).css({
      top: Math.floor(index / round) * height,
      height: height,
      left: (index % round) * width,
      width: width
    });

    $(this).find("video").css({
      "max-width": width - 20,
      "max-height": height - 20
    })

  })
}

function renderLogin(divList, item) {
  let cls = "free-member";
  let title = "Call " + item.fullname;
  let icon = '<span class="user-login-call" title="Freedom"><i class="fa fa-phone" aria-hidden="true"></i></span> ';
  if (item.member == MEMBER_TYPE.HOST_MEMBER) {
    title = "Join in " + item.fullname;
    cls = "host-member";
    icon = '<span class="user-login-call" title="Streaming..."><i class="fa fa-wechat" aria-hidden="true"></i></span>';
  } else if (item.member == MEMBER_TYPE.CLIENT_MEMBER) {
    // cls = "client-member";
    return;
  }

  divList.prepend('<div data-username="' + item.username + '" class="user-login ' + cls + '" title="' + title + '">' +
    icon +
    '<span class="user-login-fullname">' + item.fullname + '</span>' +
    '</div>');
}

btnLogin.onclick = function() {
  socket.emit("LOGIN", {
    username: username.value,
    password: password.value,
    peerId: peerId,
  });

  return false;
}

function callRequest(username) {
  openStream().then(function(stream) {
    localStream = stream;
    socket.emit("CALL_REQUEST", username);
  });
  return false;
}

function openStream() {
  const config = {
    audio: true,
    video: true
  };
  return navigator.mediaDevices.getUserMedia(config);
}

function playLocal(stream) {
  localVideo.srcObject = stream;
  // localVideo.play();
  arrangeVideo();
}

function playRemote(remoteStream, peerId) {
  let div = $('<div class="live-video remote-video" data-peer="' + peerId + '"><div class="live-video-wrapper"><div class="live-video-inner"><label></label></div></div></div>');
  let remoteVideo = $('<video />');
  div.find(".live-video-inner").append(remoteVideo);
  $('#divLive').append(div);
  remoteVideo[0].srcObject = remoteStream;
  remoteVideo[0].play();
  socket.emit("GET_FULL_NAME", {
    selector: ".remote-video[data-peer=" + peerId + "] .live-video-inner label",
    peerId: peerId
  });

  arrangeVideo();
}

function logout() {
  showLogin();
}

function stopStream(stream) {
  if (stream !== undefined) {
    stream.getAudioTracks()[0].stop();
    stream.getVideoTracks()[0].stop();
    stream = undefined;
  }
}

function showLogin() {
  login = false;
  $("#divLogin").animate({
    height: "show",
    width: "show"
  }, 200);

  $(".user-list").empty();

  localVideo.srcObject = undefined;
  stopStream(localStream);
  $("#divLoged").animate({
    height: "hide",
    width: "hide"
  }, 200);
}

function showLoged() {
  login = true;
  $("#divLogin").animate({
    height: "hide",
    width: "hide"
  }, 200);

  $("#divLoged").animate({
    height: "show",
    width: "show"
  }, 200);

  $("#divUserList").animate({
    height: "show",
    width: "show"
  }, 200);

  $("#divLive").animate({
    height: "hide",
    width: "hide"
  }, 200);

  localVideo.srcObject = undefined;
  stopStream(localStream);
  $(".remote-video").remove();
  //buttons
  $("#btnUserList").hide();
  $("#btnLogout").show();
  $("#btnMicrophone").hide();
  $("#btnCamera").hide();
  $("#btnCloseLive").hide();
}

function showLive() {
  //reset control
  $(".live-control.slash").each(function() {
    //hide slash
    $(this).find(".live-control-slash").hide();
    this.showSlash = false;
  })

  $("#divUserList").animate({
    height: "hide",
    width: "hide"
  }, 200);

  $("#divLive").animate({
    height: "show",
    width: "show"
  }, 200);

  //buttons
  $("#btnUserList").hide();
  $("#btnLogout").hide();
  $("#btnMicrophone").show();
  $("#btnCamera").show();
  $("#btnCloseLive").show();
}

var timeoutControls, hardShow;
$(document).ready(function() {
  $(document).on("click", ".user-login", function() {
    callRequest($(this).attr("data-username"));
  })

  $("#btnLogout").on("click", function() {
    socket.emit("LOGOUT");
    logout();
  })

  $(document).on("click", ".live-control.slash", function() {
    if (this.showSlash) {
      //hide slash
      $(this).find(".live-control-slash").hide();
      this.showSlash = false;
    } else {
      //show slash
      $(this).find(".live-control-slash").show();
      this.showSlash = true;
    }
  })

  $("#divLoged").on("mousemove", function() {
    if (!hardShow) {
      // console.log("Mouse move");
      $(".controls").addClass("active");
      clearTimeout(timeoutControls);
      timeoutControls = setTimeout(function() {
        $(".controls").removeClass("active");
      }, 3000);
    }
  })

  $(".live-control").on("mouseover", function(e) {
    // console.log("Mouse Enter");
    hardShow = true;
    clearTimeout(timeoutControls);
    $(".controls").addClass("active");
  })

  $(".live-control").on("mouseleave", function(e) {
    // console.log("Mouse out");
    hardShow = false;
  })

  $("#btnUserList").on("click", function() {
    if (this.showList) {
      this.showList = false;
      //hide
      $("#divUserList").animate({
        height: "hide",
        width: "hide"
      }, 200);
    } else {
      //show
      this.showList = true;
      $("#divUserList").animate({
        height: "show",
        width: "show"
      }, 200);
    }
  })

  $("#btnCloseLive").on("click", function() {
    showLoged();
    socket.emit("LEAVE_ROOM");
  })

  $("#btnMicrophone").on("click", function() {
    if (localStream !== undefined) {
      localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
    }
  })

  $("#btnCamera").on("click", function() {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
  })

  $(window).on("resize", function() {
    arrangeVideo();
  })
})
