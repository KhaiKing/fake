// const socket = io("http://192.168.1.124:8888");
const socket = io("https://facebook-fake.herokuapp.com/");

var peerId, customConfig, localStream, messageId = 0;

$.ajax({
  url: "https://global.xirsys.net/_turn/TurnRTC/",
  type: "PUT",
  async: false,
  headers: {
    "Authorization": "Basic " + btoa("khaiking:9e68b986-75d2-11e7-ba8b-d7aa9a6627d5")
  },
  success: function(res) {
    customConfig = res.v;
  }
});

// customConfig = { 'iceServers': [
//   {
//     url: 'turn:turn.anyfirewall.com:443?transport=tcp',
//     credential: 'webrtc',
//     username: 'webrtc'
//   }
// ]};

console.log(customConfig);

var peer = new Peer({
  key: 'peerjs',
  host: 'peerjs-server-001.herokuapp.com',
  secure: true,
  port: 443,
  config: customConfig
});

// var peer = new Peer({
//   key: 'kv7pis9v4n3o9a4i',
// });

function playLocal(stream) {
  localVideo.srcObject = stream;
}

function playRemote(remoteStream, peerId) {
  try {
    remoteVideo.srcObject = remoteStream;
    remoteVideo.play();
  }
  catch(err) {
    alert("Error: " + err.message);
  }
}

//PEER
peer.on("open", function(id) {
  peerId = id;
})

function openStream() {
  const config = {
    audio: true,
    video: true
  };

  return navigator.mediaDevices.getUserMedia(config);
}

function playPeer(call) {
  showLive();

  playLocal(localStream);
  call.answer(localStream);
  call.on("stream", function(remoteStream) {
    playRemote(remoteStream, call.peer);
  })
}

peer.on("call", function(call) {
  if (localStream !== undefined) {
    playPeer(call);
  } else {
    openStream().then(function(stream) {
        localStream = stream;
        playPeer(call);
      })
      .catch(err => {
        alert(err.message)
      });
  }
})

function showLive(peerId) {
  $(".video-region").css("display", "block");
  $(".list-provider-box").addClass("isHide");
  $(".chat-box.isShow").addClass("isHide");
  $(".btn-logout").css("display", "none");
  showLiveControls();
}

//SOCKET EVENT
socket.on("STOP_CALL", function(response){
  $.each(response.usernames, function(){
    $(".provider[data-username=" + this + "]").removeClass("calling");
  })
})

socket.on("QUIT_LIVE", function(response){
  showLoged();
  vex.dialog.alert({
    message: response.fullname + " quited",
    className: 'vex-theme-default',
  })
})

socket.on("NEW_CALLING", function(response) {
  $(".provider[data-username=" + response.caller + "]").addClass("calling");
  $(".provider[data-username=" + response.receiver + "]").addClass("calling");
})

var callRequestDialog;
socket.on("CALL_REQUEST", function(response) {
  callRequestDialog = vex.dialog.confirm({
    message: response.fullname + " want to call u?",
    className: 'vex-theme-default',
    callback: function(value) {
      socket.emit("CALL_RESPONSE", {
        username: response.username,
        agree: value
      });
    }
  })
})

socket.on("CANCEL_CALL_REQUEST", function() {
  if (callRequestDialog !== undefined) {
    callRequestDialog.close();
  }
})

socket.on("CALL_RESPONSE", function(response) {
  if (response.success) {
    openStream().then(function(stream) {
        localStream = stream;
        playLocal(localStream);

        let call = peer.call(response.peerId, localStream);
        call.on("stream", function(remoteStream) {
          playRemote(remoteStream, call.peer);
        });
      })
      .catch(err => {
        alert(err.message)
      });
    showLive();
  } else {
    vex.dialog.alert({
      message: response.message,
      className: 'vex-theme-default'
    });
  }
})

socket.on("LOGOUT", function(response) {
  $(".list-provider .provider[data-username=" + response + "]")
    .removeClass("calling").removeClass("online").addClass("offline");
  updateCounterProvider();
})

socket.on("LOGIN_RESULT", function(response) {
  if (response.success) {
    $("#loginPassword").val('');

    renderProvider(response.result);

    showLoged();
  } else {
    showLoginError(response.message);
  }
})

socket.on("NEW_LOGIN", function(response) {
  $(".list-provider .provider[data-username=" + response + "]").removeClass("offline").addClass("online");
  updateCounterProvider();
})

socket.on("RECEIVE_MESSAGE", function(response) {
  createOtherMessage(response.message, response.username, response.fullname, response.avatar);
})

socket.on("SEND_MESSAGE", function(response) {
  var chatbox = openChat(response.username, response.fullname, response.avatar);
  var content = chatbox.find(".box-3-content");
  messageId = response.messageId;
  content.append(createOwnMessage(response.message, messageId));
  content.scrollTop(content[0].scrollHeight);
  arrangeChat();
})

socket.on("SEND_MESSAGE_FAILED", function(response) {
  $(".text-message.own-message[data-messageId=" + response.messageId + "]")
  .after('<div class="message-error">' + response.error + '</div>')
})


//CUSTOM INPUT
$(document).on("keyup change paste", ".custom-input-content input", function() {
  if ($(this).val().length > 0) {
    $(this).parent().siblings(".custom-input-clear").css("display", "inline-block");
  } else {
    $(this).parent().siblings(".custom-input-clear").css("display", "none");
  }
});
$(document).on("click", ".custom-input-icon", function() {
  $(this).siblings(".custom-input-content").children().focus();
})
$(document).on("click", ".custom-input-clear", function() {
  $(this).siblings(".custom-input-content").children().focus().val('');
})

function activeChatbox(chatbox) {
  $(".chat-box.active").removeClass("active");
  chatbox.addClass("active");
  setTimeout(function() {
    chatbox.find(".box-3-footer .custom-input-content input").focus();
  }, 200);
}

//CHAT BOX
$(document).on("click", ".chat-box .custom-input-content input", function() {
  activeChatbox($(this).parents(".chat-box"));
})

$(document).on("click", ".chat-box-close", function() {
  $(this).parents(".chat-box").remove();
  arrangeChat();
  activeChatbox($(".chat-box.isShow").first());
})

//click header
$(document).on("click", ".chat-box-header", function() {
  let chatbox = $(this).parents(".chat-box");
  if (chatbox.hasClass("isHide")) {
    chatbox.removeClass("isHide");
  } else {
    chatbox.addClass("isHide");
  }
})

$(document).on("click", ".chat-box-controls", function(e) {
  e.stopPropagation();
})

$(document).on("keypress", ".chat-box .custom-input-content input", function(e) {
  let message = $(this).val().trim();
  if (message == '') {
    return;
  }
  var key = e.keyCode || e.which;
  if (key == 13) {
    //enter => send chat
    var username = $(this).parents(".chat-box").attr("data-username");
    var content = $(this).parents(".box-3-footer").siblings(".box-3-content");
    content.append(createOwnMessage(message, messageId));
    content.scrollTop(content[0].scrollHeight);
    $(this).val('');
    socket.emit("SEND_MESSAGE", {
      message: message,
      messageId: messageId++,
      username: username
    });
  }
})

$(document).on("click", ".show-hidden-user", function() {
  var listHiddenUser = $(".list-hidden-user");
  if (listHiddenUser.hasClass("isShow")) {
    //hide
    listHiddenUser.removeClass("isShow");
  } else {
    //show
    listHiddenUser.addClass("isShow");
  }
})

$(document).on("click", ".hidden-user", function() {
  var chatbox = $(".chat-box[data-username=" + $(this).attr("data-username") + "]");
  chatbox.prependTo($(".chat-region"));
  arrangeChat();
  activeChatbox(chatbox);

  $(".list-hidden-user").removeClass("isShow");
})

$(document).on("click", ".live-camera", function(){
  if($(this).hasClass("slash")) {
    $(this).removeClass("slash").attr("title", "No Video");
  }
  else {
    $(this).addClass("slash").attr("title", "Show Video");;
  }
  if (localStream !== undefined) {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
  }
})

$(document).on("click", ".live-microphone", function(){
  if($(this).hasClass("slash")) {
    $(this).removeClass("slash").attr("title", "Mute");
  }
  else {
    $(this).addClass("slash").attr("title", "Unmute");
  }
  if (localStream !== undefined) {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
  }
})

function showLiveControls(){
  if(!hardShow) {
    $(".live-controls").addClass("isShow");
    clearTimeout(liveControlsTimeout);
    liveControlsTimeout = setTimeout(function(){
      $(".live-controls").removeClass("isShow");
    }, 3000);
  }
}

var liveControlsTimeout, hardShow;
$(".video-region").on("mousemove", function(){
   showLiveControls();
})

$(document).on("mouseenter", ".live-control", function(){
  hardShow = true;
  $(".live-controls").addClass("isShow");
  clearTimeout(liveControlsTimeout);
})

$(document).on("mouseleave", ".live-control", function(){
  hardShow = false;
})


$(".live-quit").on("click", function(){
  showLoged();
  socket.emit("QUIT_LIVE");
})

$(window).on("resize", arrangeChat);

function arrangeChat() {
  var chatRegion = $(".chat-region");
  var count = chatRegion.children().length;
  let width = chatRegion.width();
  let round = Math.floor((width + 10) / 260);
  var chatboxs = chatRegion.children(":not(.hidden-chatbox)");
  var listHiddenUser = $(".list-hidden-user");
  var showHiddenUser = $(".show-hidden-user");

  listHiddenUser.empty();

  chatboxs.each(function(index, chatbox) {
    $(chatbox).css({
      "right": index * 260,
      "width": ""
    });
    if (index < round) {
      //show
      $(chatbox).addClass("isShow");
    } else {
      // hide
      $(chatbox).removeClass("isShow");
      listHiddenUser.append('<div class="hidden-user" data-username="' + $(chatbox).attr("data-username") + '">' +
        $(chatbox).attr("data-fullname") + '</div>');
    }
  })

  if (chatboxs.length > round && chatboxs.length > 1) {
    showHiddenUser.css("display", "block");

    if ((width - round * 260) > listHiddenUser.width() && round > 0) {
      listHiddenUser.css({
        "left": "",
        "right": round * 260,
      });
    } else {
      listHiddenUser.css({
        "left": 0,
        "right": ""
      });
    }

    if ((width - round * 260) > 40) {
      showHiddenUser.css({
        "right": round * 260,
        "left": "",
        "bottom": 0
      });
      listHiddenUser.css({
        "bottom": 31,
      });
    } else {
      showHiddenUser.css({
        "right": "",
        "left": 0,
        "bottom": 35
      });
      listHiddenUser.css({
        "bottom": 66,
      });
    }
  } else {
    showHiddenUser.css("display", "none");
  }
}

function createOwnMessage(text, messageId) {
  return $('<div data-messageId="' + messageId + '" class="text-message own-message"></div>').text(text);
}

function createOtherMessage(text, username, fullname, avatar) {
  var chatbox = openChat(username, fullname, avatar);
  var html = $('<div class="text-message other-message"><img title="' + fullname + '" src="' + avatar + '" class="chat-box-avatar" /></div>');
  var message = $('<div class="chat-box-message"></div>').text(text);
  html.append(message);
  var content = chatbox.find(".box-3-content");
  content.append(html);
  content.scrollTop(content[0].scrollHeight);
  arrangeChat();
}


//Provider Box
$(document).on("click", ".provider-box-header", function() {
  if ($(".list-provider-box").hasClass("isHide")) {
    $(".list-provider-box").removeClass("isHide");
  } else {
    $(".list-provider-box").addClass("isHide");
  }
})

$(document).on("click", ".provider-box-controls", function(e) {
  e.stopPropagation();
})

$(document).on("click", ".call-icon", function(e) {
  e.stopPropagation();
  callRequest($(this).attr("data-username"));
});

$(document).on("click", ".chat-box-call", function(e) {
  e.stopPropagation();
  callRequest($(this).parents(".chat-box").attr("data-username"));
})

$("#filterProvider").on("keyup change paste", function() {
  var input = $(this);
  setTimeout(function() {
    filterProvider(input.val());
  }, 100);
});

function callRequest(username) {
  socket.emit("CALL_REQUEST", username);
}

$(document).on("click", ".chat-icon, .provider.online", function(e) {
  e.stopPropagation();
  var chatbox = openChat($(this).attr("data-username"), $(this).attr("data-fullname"), $(this).attr("data-avatar"));
  arrangeChat();
  if (chatbox.hasClass("isShow")) {
    activeChatbox(chatbox);
  } else {
    $(".hidden-user[data-username=" + $(this).attr("data-username") + "]").click();
  }

  if ($(window).width() < 601) {
    $(".list-provider-box").addClass("isHide");
  }
});

function openChat(username, fullname, avatar) {
  var chatbox = $(".chat-box[data-username=" + username + "]");
  if (chatbox.length > 0) {
    chatbox.children(".box-3-header").stop(true, false)
      .animate({
        opacity: 0.5
      }, 200)
      .animate({
        opacity: 1
      }, 300);
    return chatbox;
  }

  var chatbox = $('<div class="box-3 chat-box active" data-fullname="' + fullname + '" data-avatar="' + avatar + '" data-username="' + username + '">' +
    '<div class="box-3-header">' +
    '<div class="chat-box-header">' +
    '<span class="chat-box-title">' +
    fullname +
    '</span>' +
    '<span class="chat-box-controls">' +
    '<i class="fa fa-phone chat-box-control chat-box-call" title="Call ' + fullname + '" aria-hidden="true"></i>' +
    '<i class="fa fa-cog chat-box-control" aria-hidden="true"></i>' +
    '<i class="fa fa-close chat-box-control chat-box-close" aria-hidden="true"></i>' +
    '</span>' +
    '</div>' +
    '</div>' +
    '<div class="box-3-content scroll-style-6"></div>' +
    '<div class="box-3-footer">' +
    '<div class="custom-input">' +
    '<span class="custom-input-content">' +
    '<input type="text" placeholder="Say something..."/>' +
    '</span>' +
    '</div>' +
    '</div>' +
    '</div>');

  chatbox.prependTo($(".chat-region"));
  return chatbox;
}


var filterTimeout;

function filterProvider(searchText) {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(function() {
    if (searchText === undefined) {
      searchText = '';
    }
    searchText = searchText.toLowerCase();
    $(".overplay-provider").addClass("isShow");
    $(".list-provider .provider").each(function() {
      if ($(this).attr("data-fullname").toLowerCase().indexOf(searchText) != -1) {
        $(this).css("display", "block");
      } else {
        $(this).css("display", "none");
      }
    })
    setTimeout(function() {
      $(".overplay-provider").removeClass("isShow");
    }, 500);
  }, 200);
}

$(document).on("click", ".btn-login", function() {
  login();
  // showLoged();
  return false;
})

function login() {
  $("#loginSummary .text-error").addClass("fade-out");
  setTimeout(function() {
    $("#loginSummary").empty();
    checkLogin();
  }, 200);
}

function checkLogin() {
  socket.emit("LOGIN", {
    username: $("#loginUsername").val(),
    password: $("#loginPassword").val(),
    peerId: peerId
  });
}

function showLoginError(message) {
  var error = $('<span class="text-error fade fade-out">' + message + '</span>');
  error.appendTo($("#loginSummary"));
  setTimeout(function() {
    error.removeClass("fade-out");
  }, 100);
}

function removeStream(stream) {
  if(stream !== undefined) {
    stream.getVideoTracks()[0].enabled = false;
    stream.getVideoTracks()[0].stop();
    stream.getAudioTracks()[0].enabled = false;
    stream.getAudioTracks()[0].stop();
  }
}

function showLoged() {
  $(".login-panel").addClass("fade-out");
  $(".loged-panel").removeClass("fade-out");
  $(".list-provider-box").removeClass("isHide");
  $(".video-region").css("display", "none");
  $(".btn-logout").css("display", "block");

  localVideo.src = "";
  remoteVideo.src = "";
  removeStream(localStream);
  localStream = undefined;

  $(".live-camera").removeClass("slash");
  $(".live-microphone").removeClass("slash");
}

function renderProvider(arr) {
  let listProvider = $(".list-provider");
  listProvider.empty();
  counterProvider = 0;
  $.each(arr, function(index, item) {
    let callClass = "offline";
    if (item.status == 2) {
      //calling
      callClass = "online calling";
      counterProvider++;
    } else if (item.status == 1) {
      callClass = "online";
      counterProvider++;
    }

    var html = '<div  data-avatar="' + item.avatar + '" data-fullname="' + item.fullname + '" data-username="' + item.username + '" class="provider ' + callClass + '" title="' + item.fullname + '">' +
      '<span class="provider-avatar" style="background-image: url(' + item.avatar + ');"></span>' +
      '<span class="provider-name">' + item.fullname + '</span>' +
      '<span class="provider-status">' +
      '<i class="fa fa-user status-icon" aria-hidden="true"></i>' +
      '<i class="fa fa-users status-icon group-icon" aria-hidden="true"></i>' +
      '<i class="fa fa-phone call-icon online-icon" data-avatar="' + item.avatar + '" data-fullname="' + item.fullname + '" data-username="' + item.username + '" title="Call Provider 1" aria-hidden="true"></i>' +
      '<i class="fa fa-commenting-o chat-icon online-icon" data-avatar="' + item.avatar + '" data-fullname="' + item.fullname + '" data-username="' + item.username + '" title="Chat with ' + item.fullname + '" aria-hidden="true"></i>' +
      '</span>' +
      '</div>';

    listProvider.append(html);
  });

  updateCounterProvider();
}

function updateCounterProvider() {
  $("#counterProvider").text("(" + $(".provider.online").length + "/" + $(".list-provider").children().length + ")");
}

$(document).on("click", ".btn-logout", function() {
  socket.emit("LOGOUT");
  showLogin();
})

function showLogin() {
  $(".login-panel").removeClass("fade-out");
  $(".loged-panel").addClass("fade-out");
  $(".chat-region").children(":not(.hidden-chatbox)").remove();
  $(".video-region").css("display", "none");
  $("#loginUsername").focus();
}

$(document).ready(function() {
  $("#loginUsername").focus();
})
