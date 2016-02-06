angular.module('starter.login', [])

.controller('LoginCtrl', function($scope, $timeout, $stateParams, $state, $ionicHistory, awsApi) {
    $scope.user = {};
    
    $scope.login = function() {
        var loginCredential = {
            email: $scope.user.email,
            password: $scope.user.password
        };
        
        awsApi.usersLoginPost({}, loginCredential)
            .then(function(result) {
                alert("Login has succeeded!" + JSON.stringify(result));
                var credentials = result.data.credentials;
                awsApi.refresh(credentials.AccessKeyId, credentials.SecretKey, credentials.SessionToken);
                $state.go('app.profile');
            }).catch(function(result) {
                alert("Login has failed!" + JSON.stringify(result));
            });
    }
});
