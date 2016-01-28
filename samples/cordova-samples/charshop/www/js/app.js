// We use an "Immediate Function" to initialize the application to avoid leaving anything behind in the global scope
(function () {

    /* ---------------------------------- Local Variables ---------------------------------- */
    HomeView.prototype.template = Handlebars.compile($("#home-tpl").html());
    CharacterListView.prototype.template = Handlebars.compile($("#character-list-tpl").html());
    CharacterView.prototype.template = Handlebars.compile($("#character-tpl").html());
    
    var slider = new PageSlider($('body'));
    var service = new CharacterService();
    service.initialize().done(function () {
        router.addRoute('', function() {
            slider.slidePage(new HomeView(service).render().$el);
        });
        
        router.addRoute('characters/:name', function(name) {
            /*
            service.findByName(name).done(function(character) {
                slider.slidePage(new CharacterView(character).render().$el);
            });
            */
            service.findByName(name)
                .then(function(character) {
                    //alert("Ready to slide the selected character page: " + JSON.stringify(character));
                    slider.slidePage(new CharacterView(character.data).render().$el);
                }).catch(function(result) {
                    alert("Cannot retrieve the selected character!");
                });
        });
        
        router.start();
    });

    /* --------------------------------- Event Registration -------------------------------- */
    /*
    $('.search-key').on('keyup', findByName);
    $('.help-btn').on('click', function() {
        alert("Character Directory v3.4");
    });
    */
    
    document.addEventListener('deviceready', function () {
        if (navigator.notification) {   // Override default HTML alert with native dialog
            window.alert = function (message) {
                navigator.notification.alert(
                    message,            // message
                    null,               // callback
                    "Workshop",         // title
                    'OK'                // buttonName
                );
            };
        }
    }, false);

    /* ---------------------------------- Local Functions ---------------------------------- */

    /* ---------------------------------- SPA View Functions ---------------------------------- */
}());