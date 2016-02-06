angular.module('starter.controllers', [])

.controller('AppCtrl', function($scope, $ionicModal, $timeout) {
  // Form data for the login modal
  $scope.loginData = {};

  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.login = function() {
    $scope.modal.show();
  };

  // Perform the login action when the user submits the login form
  $scope.doLogin = function() {
    console.log('Doing login', $scope.loginData);

    // Simulate a login delay. Remove this and replace with your login
    // code if using a login system
    $timeout(function() {
      $scope.closeLogin();
    }, 1000);
  };
})

.controller('NavigationCtrl', function($scope, $state,$ionicHistory) {

  // Function to go states. We're using ng-click="go('app.state')" in all our anchor tags
  $scope.go = function(path){
      // console.log('working. Click was Triggered');
      $state.go(path);
      console.log($ionicHistory.viewHistory());
  }

  //Function to go back a step using $ionicHistory
  $scope.goBackAStep = function(){
      console.log('clicked');
      $ionicHistory.goBack();
  }

})


.controller('JCardsCtrl', function($scope) {
  console.log('CARDS CTRL Initiated');
   var cardTypes = [
    { 
      image: 'img/demo/tinder-full-pic.jpg', 
      title: 'Samantha Gamblesx', location: 'Manchester', 
      description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit.',
      vipStatus : false
    },
    { 
      image: 'img/demo/tinder-full-pic-2.jpg', 
      title: 'Junior Max', location: 'Manchester', 
      description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit.',
      vipStatus : true
    },
    { 
      image: 'img/demo/tinder-full-pic-3.jpg', 
      title: 'Karla Valentine', location: 'Manchester', 
      description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit.',
      vipStatus : true
    }
  ];

  $scope.cardsControl = {};
  
  $scope.reload = function() {
    $scope.cards = Array.prototype.slice.call(cardTypes, 0);

    //we'll need to have a counter for the cards deck
    $scope.cardCounter = $scope.cards.length;

    //we'll need a variable to tell us if the deck is empty or full. since we're reloading, default is false
    $scope.deckIsEmpty = false;

    //we'll clone our $scope.cards for our own custom functions (like counting and exposing card data)
    $scope.cardDataArray = $scope.cards.slice(0);

    //If a card is swyped, its details will always be here. if we are resetting/updating the stack, 
    // this variable will be reset. refer to the $scope.exposeSwypedCard function
    $scope.swypedCard = null;

    // debug data
    console.log('cards in deck: '+$scope.cards.length);
  }

  $scope.exposeSwypedCard = function() {
    //since a card has been removed from deck, reduce counter by 1 
    //we're doing this to balance the 0-notation of arrays vs the array.lenght
    $scope.cardCounter -= 1;

    //if deck is empty set variable to true
    if ($scope.cardCounter === 0){
      $scope.deckIsEmpty = true;
      console.log('deck is empty!');
    }
    

    //we'll use the cardCounter as the index in our cloned array for that card's 
    //data
    $scope.swypedCard = $scope.cardDataArray[$scope.cardCounter];


    //output to console. use to your preference
    console.log($scope.swypedCard);
  }

  $scope.cardDestroyed = function(index) {
    $scope.cards.splice(index, 1);
  };

  $scope.addCard = function() {
    var newCard = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    newCard.id = Math.random();
    $scope.cards.push(angular.extend({}, newCard));
  };
  
  $scope.yesClick = function() {
    $scope.cardsControl.swipeRight();
  };
  
  $scope.noClick = function() {
    $scope.cardsControl.swipeLeft();
  };
  
  $scope.cardSwipedLeft = function(index) {
    console.log('LEFT SWIPE');
    $scope.exposeSwypedCard();
  };
  
  $scope.cardSwipedRight = function(index) {
    console.log('RIGHT SWIPE');
    $scope.exposeSwypedCard();
  };

  $scope.cardDetails = function(card) {

  }
  
  $scope.reload()
});