var HomeView = function (service) {
    var characterListView;
    
    this.initialize = function () {
        // Define a div wrapper for the view (used to attach events)
        this.$el = $('<div/>');
        this.$el.on('keyup', '.search-key', this.findByName);
        characterListView = new CharacterListView();
        this.render();
    };
    
    this.render = function () {
        this.$el.html(this.template());
        $('.content', this.$el).html(characterListView.$el);
        return this;
    };
    
    this.findByName = function () {
        /*
        service.findAll($('.search-key').val()).done(function(characters) {
            characterListView.setCharacters(characters.Items);
        });
        */
        service.findAll($('.search-key').val())
            .then(function(characters) {
                //alert("Retrieve the list of characters: " + JSON.stringify(characters));
                characterListView.setCharacters(characters.data);
            }).catch(function(result) {
                alert("Cannot retrieve the list of characters!");
            });
    };
    
    this.initialize();
}