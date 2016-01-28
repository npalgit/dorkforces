/* Custom Scripts */
$(document).ready(function () {
		
	// Start One Page Scrolling
	$('.top-menu').singlePageNav({
		offset: 40,
		filter: ':not(.external)',
	});

    $('.navbar .nav a').on('click', function(){ 
        if($('.navbar-toggle').css('display') !='none'){
            $(".navbar-toggle").trigger( "click" );
        }
    });

	// Start Parallax script
	$('.bg-img').parallax("50%", 0.1);
	$('#quoteArea').parallax("50%", 0.2);
	$('#videoArea').parallax("50%", 0.1);
	$('#clientsArea').parallax("50%", 0.1);

	// Start main image 
	var viewHeight = $(window).height();
	$("#main-slider .bg-img").css({
		'height': viewHeight
	});
	$(window).on('resize', function () {
		var viewHeight = $(window).height();
		$("#main-slider .bg-img").css({
			'height': viewHeight
		});
	});
	
	// Start work gallery
	$('#Grid').mixitup();
	
	// Start Main Content Slider
	$('#main-slider').flexslider({
		animation: "fade",
		slideshowSpeed: 5000,
		pauseOnHover: false, 
		useCSS: false,
		directionNav: true,
		controlNav: false,
		touch: true,
		prevText: "<span class='fa fa-caret-left'></span>",
		nextText: "<span class='fa fa-caret-right'></span>",
	});
	
	// Start testimonials Slider
	$('#testimonials-slider').flexslider({
		animation: "slide",
		useCSS: false,
		directionNav: true,
		controlNav: false,
		touch: true,
		prevText: "<span class='fa fa-caret-left'></span>",
		nextText: "<span class='fa fa-caret-right'></span>",
	});
	
	// Start Clients slider
	$('#clients-slider').flexslider({
        animation: "slide",
        animationLoop: false,
		directionNav: true,
		controlNav: false,
        itemWidth: 190,
        itemMargin: 0,
        minItems: 1,
        move: 1,
        maxItems: 4,
		prevText: "<span class='fa fa-caret-left'></span>",
		nextText: "<span class='fa fa-caret-right'></span>",
        start: function(slider){
          $('body').removeClass('loading');
        }
      });
	
	// Start Header Animation
	$(window).scroll(function () {
		if ($(document).scrollTop() == 0) {
			$('.top-menu').removeClass('tiny');
		} else {
			$('.top-menu').addClass('tiny');
		}
	});

	// Start ToolTip
	$('[data-toggle=tooltip]').tooltip() 
	
	// Start PoPover
	$('[data-toggle=popover]').popover()

	// prettyPhoto script start here
    $('a[data-gal]').each(function() {
        $(this).attr('rel', $(this).data('gal'));
    });     
    $("a[data-rel^='prettyPhoto']").prettyPhoto({animationSpeed:'slow',theme:'light_square',slideshow:false,overlay_gallery: false,social_tools:false,deeplinking:false});
					
});	