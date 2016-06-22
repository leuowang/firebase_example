angular.module('hotelApp.controllers', [])
        .controller('orderCtrl', function ($scope, $uibModal, Mibc, AuthService,
                $location, ORDERS_HEADER, TESTORDERS) {
            $scope.header = ORDERS_HEADER.order_header; // 表格header
            var orders = TESTORDERS.orders;

            $scope.addOrder = function () {
                angular.forEach(orders, function (order) {
                    AuthService.addOrder(order);
                });
            }

            AuthService.getMyOrders(AuthService.getUserId()).$loaded()
                    .then(function (orders) {
                        console.log('orders:', orders);
                        //var myorders = orders;
                        $scope.orders = [];
                        angular.forEach(orders, function (order) {
                            console.log('order', order);
                            AuthService.getOrder(order.order_id).$loaded()
                                    .then(function (data) {
                                        var myorder = order;
                                        myorder.detail = data;
                                        $scope.orders.push(myorder);
                                    }).catch(function (error) {
                                console.error('Error:', error);
                            });
                        })
                    }).catch(function (error) {
                console.error('Error:', error);
            });

            /**
             * 編輯與新增訂房modals
             * @param {type} op
             * @returns {undefined}
             */
            $scope.open = function (op) {
                if (op == "add") {
                    $scope.order = {};
                } else {
                    $scope.order = {oid: 1, name: '王小明'};
                }
                var modalInstance = $uibModal.open({
                    animation: true,
                    templateUrl: 'templates/orderModalEdit.html',
                    controller: 'orderModalEditCtrl',
                    resolve: {
                        order: function () {
                            return $scope.order;
                        }
                    }
                });
                modalInstance.result.then(function (orderdata) {
                    $scope.order = orderdata;
                    console.log($scope.order);
                }, function () {
                    console.log('Modal dismissed at: ' + new Date());
                });
            };



        })
        .controller('orderModalEditCtrl', function ($scope, $uibModalInstance, order) {
            $scope.order = order;
            $scope.name = order.name; // 旅客姓名
            $scope.person = 1;        // 人數
            $scope.rooms = ['1001', '1002', '1003', '1004'];
            $scope.room = $scope.rooms[0];

            $scope.ok = function () {
                $scope.order = {
                    name: $scope.name,
                    sdate: $scope.startDate,
                    eDate: $scope.endDate,
                    person: $scope.person,
                    room: $scope.room
                }
                $uibModalInstance.close($scope.order);
            };

            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };

            /**
             * 訂房日期相關$scope變數
             */
            $scope.startDate = '';
            $scope.endDate = '';   // 今天
            $scope.minDate = new Date();  // 訂房日期不得早過今天
            var time = new Date();
            $scope.maxDate = time.setDate(time.getDate() + 90); // 訂房日期必須在90天內
            $scope.popupSDate = {opened: false};
            $scope.popupEDate = {opened: false};
            $scope.dateOptions = {
                formatYear: 'yy',
                startingDay: 1
            };
            $scope.altInputFormats = ['M!/d!/yyyy'];

            $scope.openSDate = function () {
                $scope.popupSDate.opened = true;
            }
            $scope.openEDate = function () {
                $scope.popupEDate.opened = true;
            }
        })
        .controller('DashboardCtrl', function ($scope, $location, Mibc, $filter) {
            if (window.localStorage.getItem('uid') != null) { // 已登入
                $scope.uid = window.localStorage.getItem('uid');
                $scope.header = ['旅客姓名', '入住日期', '退房日期', '人數', '房間', '狀態'];
                $scope.ngclass = ['active', 'success', 'warning', 'danger'];
                var time = new Date();
                Mibc.getOrders().$loaded()
                        .then(function (x) {
                            //x === list; // true
                            console.log("data", x);
                            $scope.totalorders = x.length; // 訂單總數
                            //var maxDate = $filter('date')(new Date(time.setDate(time.getDate() + 30)), 'yyyy/M/d' ); // 7天內
                            var maxDate = new Date(time.setDate(time.getDate() + 14)); // 14天內
                            $scope.orders = $filter('filter')(x, function (order) {
                                var bool = (new Date(order.startDate) < maxDate);
                                //var bool = (order.startDate < maxDate);
                                console.log(order.startDate, maxDate, bool);
                                return (new Date(order.startDate) < maxDate);
                            });
                            console.log('orders:', $scope.orders);
                        })
                        .catch(function (error) {
                            console.log("Error:", error);
                        });

            } else {
                $location.path('/admin');
            }
        })
        /**
         * 會員管理
         * @param {type} $scope
         * @param {type} $location
         * @returns {undefined}
         */
        .controller("MemberCtrl", function ($scope, $location, Mibc) {
            var users = [
                {name: '王小明', authority: 'member', id: '', birth: '',
                    avatar: '', id_image: '', enable: ''}
            ];
            Mibc.getUsers().$loaded()
                    .then(function (data) {
                        console.log(data);
                    })
                    .catch(function (error) {
                        console.error("Error:", error);
                    });

        })
        .controller('RoomCtrl', function ($scope, $location, AuthService, ROOMS) {
            $scope.header = ['ID', '房型', '名稱', '價格'];

            AuthService.getRooms().$loaded()
                    .then(function (data) {
                        //x === list; // true
                        console.log("data", data);
                        $scope.rooms = data;
                    })
                    .catch(function (error) {
                        console.error("Error:", error);
                    });
            /**
             * 匯入房間資料
             * @returns {undefined}
             */
            $scope.addRooms = function () {
                var options = [{
                        name: '加床',
                        amount: '1',
                        operation: 'add to price',
                        value: '500'
                    }];
                angular.forEach(ROOMS.rooms, function (room) {
                    AuthService.addRoom(room, options);
                })
            }
        })
