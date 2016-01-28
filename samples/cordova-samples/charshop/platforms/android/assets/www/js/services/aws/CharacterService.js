var CharacterService = function() {

    var apigClient = apigClientFactory.newClient();

    this.initialize = function(serviceURL) {
        var deferred = $.Deferred();
        deferred.resolve();
        return deferred.promise();
    }

    this.findByName = function(name) {
        return apigClient.charactersCharacterNameGet({characterName: name}, {});
    }

    this.findAll = function(searchKey) {
        return apigClient.charactersGet({}, {});
    }


}