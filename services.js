angular.module('starter.services', ['firebase'])
  .factory('AuthService', function($q, $filter, $http, $firebaseAuth, $firebaseObject,
    USER_ROLES, SERVICE_AUTHORITY, CONSTANT) {
    var LOCAL_TOKEN_KEY = 'authToken';
    var LOCAL_UID = 'uid';
    var userid = '';
    var username = ''; // user email
    var authority = ''; // 權限, read from database
    var isAuthenticated = false; // 登入與否
    var role = USER_ROLES.public; // 角色,預設為未登入之public角色
    var authToken; // 字串，格式為  username:servertoken

    /* firbase settings*/
    var ref = new Firebase("https://yourappname.firebaseio.com/");
    var roomRef = new Firebase("https://yourappname.firebaseio.com/rooms"); // 房間管理
    var orderRef = new Firebase("https://yourappname.firebaseio.com/orders"); // 訂單管理
    var auth = $firebaseAuth(ref); // 登入
    //var users = $firebaseObject(ref.child('users'));

    loadUserCredentials(); // 載入authToken, if 已登入

    return {
      /**
       *
       * @param {type} uid: user id or order id or room id
       * @param {type} imageType: 房間影像、身分證、頭像、監視器頭像
       * @returns {undefined}
       */
      uploadImageObject: function(id, imageType) {
        var imageRef = null;
        switch (imageType) {
          case CONSTANT.IMAGE_TYPE.id_card: // 身分證上傳
          case CONSTANT.IMAGE_TYPE.id_avatar: // 身分證頭像上傳
          case CONSTANT.IMAGE_TYPE.mobile_avatar: //手機自拍照上傳
            // id 是 user id
            imageRef = ref.child('images').child(id).child('identify');
            break;
          case CONSTANT.IMAGE_TYPE.ipc_avatar: // ip camera影像擷取上傳
            // id 是 order id
            imageRef = ref.child('orders').child(id).child('ipc_avatar');
            break;
          case CONSTANT.IMAGE_TYPE.room_status: // 房務處理照片上傳
            break;
        }
        return $firebaseObject(imageRef);
      },
      getRooms: function() {
        var rooms = $firebaseObject(ref.child('rooms'));
        return rooms;
      },
      getMyLastestOrder: function(uid) {
        var orderRef = ref.child('users').child(uid).child('orders');
        return orderRef.orderByChild("checkin_date")
          .limitToFirst(1);
        /*
         .on("child_added", function (snapshot) {
         console.log('Lastest order', snapshot.val());
         return snapshot.val();
         });
         */

      },
      getMyOrders: function(uid) {
        var myOrders = $firebaseObject(ref.child('users').child(uid).child('orders'));
        return myOrders;
      },
      /**
       * 讀取特定訂單資料
       * @param {type} orderid
       * @returns {unresolved}
       */
      getOrder: function(orderid) {
        var order = $firebaseObject(ref.child('orders').child(orderid));
        return order;
      },
      getOrders: function(uid) {
        var orders = $firebaseObject(ref.child('orders'));
        return orders;
      },
      /**
       * 取得user profile
       * @param {type} uid
       * @returns {unresolved}
       */
      getUserProfile: function(uid) {
        var user = $firebaseObject(ref.child('users').child(uid));
        return $q(function(resolve, reject) {
          user.$loaded().then(function() {
            console.log('user ' + uid + ' profile loaded');
            resolve(user);
          }).catch(function(error) {
            console.error(error);
            reject(error);
          });
        })
      },
      /**
       * 待測試
       * @param {type} username
       * @param {type} password
       * @returns {unresolved}
       */
      login: function(username, password) {
        return $q(function(resolve, reject) {
          auth.$authWithPassword({
            "email": username,
            "password": password
          }).then(function(authData) {
            console.log('authData.uid', authData.uid);
            window.localStorage.setItem(LOCAL_UID, authData.uid);
            storeUserCredentials(username + ':' + authData.token);
            resolve(authData.uid);
            //window.localStorage.setItem('uid', authData.uid);
          }, function(error) {
            reject('登入失敗');
            //console.error("Error:" + error);
          });
        });
      },
      /**
       * 登出
       * @returns {undefined}
       */
      logout: function() {
        destroyUserCredentials();
      },
      /**
       * 檢查是否登入（isAuthenticated）以及是否具有權限
       * @param {type} authorizedRoles
       * @returns {Boolean}
       */
      isAuthorized: function(authorizedRoles) {
        if (!angular.isArray(authorizedRoles)) { //不是array?
          authorizedRoles = [authorizedRoles]; // 改成array
        }
        // isAuthenticated：已登入, role也在authorizedRoles陣列裡
        console.log('登入?', isAuthenticated);
        console.log('role?', role);
        return (isAuthenticated && authorizedRoles.indexOf(role) !== -1);
      },
      isAuthenticated: function() {
        return isAuthenticated;
      },
      authority: function() {
        return authority;
      },
      username: function() {
        return username;
      },
      role: function() {
        return role;
      },
      getUserId: function() {
        return getUid();
      },
      /**
       * 設定存取role
       * @param {type} auth
       * @returns {undefined}
       */
      setRole: function(auth) {
        authority = auth; // 設定權限
        if (authority == SERVICE_AUTHORITY.admin) {
          role = USER_ROLES.admin;
        } else if (authority == SERVICE_AUTHORITY.member) {
          role = USER_ROLES.member;
        } else {
          role = USER_ROLES.public;
        }
        console.log('set role', role);
        window.localStorage.setItem('role', role);
      },
      /**
       * 以email建立新使用者
       * @param {type} user
       * @returns {unresolved}
       */
      createUser: function(user) {
        user.password = generatePassword(); // 產生16碼亂數密碼
        return $q(function(resolve, reject) {
          auth.$createUser({ // create user
            email: user.email,
            password: user.password
          }).then(function(userData) { // create user成功
            console.log("User created", userData);
            // 建立user profile
            setUsername(user.email);
            var newuser = ref.child('users').child(userData.uid);
            var name = user.email.replace(/@.*/, '');
            createUserProfile(newuser, 'password', name);
            resolve($q(function(resolve, reject) {
              // 發送重設密碼信件
              auth.$resetPassword({
                email: user.email
              }).then(function() {
                console.log("重設密碼信件已發送");
                resolve("請至" + user.email + "信箱收取認證信件並重設密碼，完成認證程序");
              }).catch(function(error) {
                console.error("Error:", error)
                reject("認證信件發送失敗，請重新發送認證信");
              });
            }));
          }).catch(function(error) {
            console.error("Error:", error);
            switch (error.code) {
              case "EMAIL_TAKEN":
                reject(user.email + "此信箱已註冊");
                break;
              case "INVALID_EMAIL":
                reject(user.email + "非有效信箱,請重新註冊");
                break;
              default:
                reject(error);
            }
          });
        })

      },
      /**
       * 認證並更新密碼
       * @param {type} email
       * @param {type} passwd
       * @returns {unresolved}
       */
      verifyUser: function(email, passwd) {
        return $q(function(resolve, reject) {
          auth.$changePassword({
            email: email,
            oldPassword: passwd.old,
            newPassword: passwd.new
          }).then(function() {
            console.log('password changed');
            resolve(email + "認證成功、密碼更新成功");
          }).catch(function(error) {
            console.error('Error:', error);
            reject(error);
          })
        });
      },
      addRoom: function(room, options) {
        //var roomRef = ref.child('rooms');
        console.log(room);
        console.log(options);

        roomRef.push({
          room_number: room.room_id, // 旅館內房間id
          unit_name: room.unit_name, // 單位名稱
          unit_type: room.unit_type, // 房間類型
          price: room.price, // 基本價格
          capacity_min: room.capacity_min, // 最少人數
          capacity_max: room.capacity_max, // 最多人數
          child_min: room.child_min, // 最少小孩人數
          child_max: room.child_max, // 最多小孩人數
          single_bed: room.single_bed, // 單人床數
          double_bed: room.double_bed, // 雙人床數
          options: options
        });
      },
      /**
       * 新增一筆訂房訂單
       * @param {type} order
       * @returns {undefined}
       */
      addOrder: function(order) {
        console.log(order);
        userid = getUid();
        var newOrder = orderRef.push();
        newOrder.set({
          username: order.username, // 登入帳號、為認證過之email
          name: order.name, // user name，會員的真實姓名
          checkin_date: order.checkin_date, // 入住日期
          checkout_date: order.checkout_date, // 退房日期
          price: order.price, // 應收款項
          paid: order.paid, // 已付款項
          person: order.person, //  人數
          room_id: order.room_id, // 系統room_id, for access room's detail
          notes: order.notes // 附註
        });
        // 取得order_id
        var order_id = newOrder.key();
        var orderObj = { // for update user order
          order_id: order_id,
          checkin: order.checkin_date,
          checkout: order.checkout_date,
          room_id: order.room_id
        }
        updateUserOrders(userid, orderObj);
        updateRoomAvailability(orderObj);
      },
    } /* end return*/

    /**
     * Local function。訂房確定後，修改房間的availibility
     * @param {type} order
     * @returns {undefined}
     */
    function updateRoomAvailability(order) {
      console.log(order);
      var roomAvailableRef = ref.child('availability')
        .child(order.room_id);

      // 根據訂單日期標註
      //var checkin = new Date(order.checkin); // 入住日期


      var day = new Date(order.checkin);
      var checkout = new Date(order.checkout); //退房日期
      do {
        var daykey = $filter('date')(day, 'yyyy-M-d')
        var avaRef = roomAvailableRef.child(daykey);
        console.log(daykey);
        avaRef.set({ // 修改availablity
          available: false,
          order_id: order.order_id
        });
        var nextDay = day;
        nextDay.setDate(day.getDate() + 1); // 隔天
      } while (nextDay < checkout);
    }
    /**
     * local function。訂單成立後，在user個人profile裡面加上訂房資料，方便後續進行入住程序
     * @param {type} uid
     * @param {type} oid
     * @returns {undefined}
     */
    function updateUserOrders(uid, order) {
      console.log(uid, order);
      var userOrderRef = ref.child('users').child(uid).child('orders');

      // 檢查 userprofile
      userOrderRef.push({
        order_id: order.order_id,
        checkin_date: order.checkin,
        checkout_date: order.checkout,
        isVerified: false, // 檢查user profile是否已驗證過
        isCheckIn: false, // 是否已經辦理入住?
        roomKey: '', // 房門鑰匙
        key_deactivated: '', // 房門鑰匙失效時間
        isCheckOut: false // 是否已退房
      });
    }

    function getUid() {
      var uid = window.localStorage.getItem(LOCAL_UID);
      console.log('my uid is ', uid);
      return uid;
    }
    /**
     * local function
     * @type type
     */
    function getUserProfile(uid) {
      var user = $firebaseObject(ref.child('users').child(uid));
      console.log('user:', user);
      return user;
    }
    /*
     * local function,產生暫時用的password
     * @returns {String}
     *
     */
    function generatePassword() {
      var possibleChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?_-';
      var password = '';
      for (var i = 0; i < 16; i += 1) {
        password += possibleChars[Math.floor(Math.random() * possibleChars.length)]
      }
      return password;
    }
    /**
     * 參考用
     * @returns {undefined}
     */
    function createRoomProfile() {
      var room = {
        // drupal rooms module欄位
        room_number: '', // 旅館內房間id
        unit_name: '', // 單位名稱
        unit_type: '', // 房間類型
        price: '', // 基本價格
        capacity_min: '', // 最少人數
        capacity_max: '', // 最多人數
        child_min: '', // 最少小孩人數
        child_max: '', // 最多小孩人數
        single_bed: '', // 單人床數
        double_bed: '', // 雙人床數
        options: [{
          name: '',
          amount: '',
          operation: '',
          value: ''
        }]
      }
    }
    /**
     * local function, 建立user profile
     * @returns {undefined}
     */
    function createUserProfile(user, provider, name) {
      var now = $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss');
      console.log(now);
      user.set({
        provider: provider, // 登入方式
        name: name, // user name
        address: '', // 住址
        mobile: '', // 電話
        id: '', // 身分證字號，從證件掃瞄來
        brith: '', // 生日
        id_avatar: '', // 身分證上照片
        avatar: '', // 頭像
        create_date: now, // 建立日期
        modified_date: now, // 修改日期
        authority: 'member'
      });
    }
    /**
     * local function 從登入的object authData取得user name
     * @param {object} authData 透過各種登入方式取得的firebase auth object
     * @return {string} user name
     */
    function getName(authData) {
      switch (authData.provider) {
        case 'password':
          return authData.passsword.email.replace(/@.*/, '');
        case 'facebook':
          return authData.facebook.displayName;
        case 'google':
          return authData.google.displayName;
      }
    }

    function setUsername(username) {
      username = username;
    }
    /**
     * local function,載入token。token格式為right.servertoken
     * @returns {undefined}
     */
    function loadUserCredentials() {
      var token = window.localStorage.getItem(LOCAL_TOKEN_KEY);
      userid = window.localStorage.getItem(LOCAL_UID);
      if (token) {
        useCredentials(token);
      }
    }
    /**
     * local function,登入成功後，儲存token到localstorage
     * @param {type} token
     * @returns {undefined}
     */
    function storeUserCredentials(token) {
      window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
      useCredentials(token);
    }
    /**
     * local function,token格式為right.servertoken。
     * @param {type} token
     * @returns {undefined}
     */
    function useCredentials(token) {
      username = token.split(':')[0]; // 從token取得username
      isAuthenticated = true; // 已登入
      authToken = token; // 設定token
      // 設定role
      role = window.localStorage.getItem('role');
      /*
      if (authority == SERVICE_AUTHORITY.admin) {
          role = USER_ROLES.admin;
      } else if (authority == SERVICE_AUTHORITY.member) {
          role = USER_ROLES.member;
      } else {
          role = USER_ROLES.public;
      }*/
      // Set the token as header for your requests!
      $http.defaults.headers.common['X-Auth-Token'] = token;
    }
    /**
     * 回復未登入狀態
     * @returns {undefined}
     */
    function destroyUserCredentials() {
      authToken = undefined;
      authority = '';
      isAuthenticated = false;
      role = USER_ROLES.public;
      $http.defaults.headers.common['X-Auth-Token'] = undefined;
      window.localStorage.removeItem(LOCAL_TOKEN_KEY);
      window.localStorage.removeItem(LOCAL_UID);
      window.localStorage.removeItem('role');
    }
  })
