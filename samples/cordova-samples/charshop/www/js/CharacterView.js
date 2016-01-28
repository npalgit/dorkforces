var CharacterView = function(item) {
    var character = item;
    
    this.initialize = function() {
        this.$el = $('<div/>');
    };
    
    this.render = function() {
        //alert("Render the selected character: " + JSON.stringify(character));
        this.$el.html(this.template(character));
        return this;
    }
    
    this.initialize();
}