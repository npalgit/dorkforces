var CharacterListView = function () {
    var characters;
    
    this.initialize = function () {
        this.$el = $('<div/>');
        this.render();
    };
    
    this.setCharacters = function(list) {
        characters = list;
        this.render();
    };
    
    this.render = function() {
        this.$el.html(this.template(characters));
        return this;
    };
    
    this.initialize();
}