angular.module('starter.services', [])

.factory('MP3Service', function($q,$cordovaFile,$http) {
	
	//root of where my stuff is
	console.log('running service');
	var items = [];

	function getAll() {
		var rootFolder = cordova.file.applicationDirectory;
		var mp3Loc = 'music/';
		//where the music is
		var mp3Folder = rootFolder + 'www/' + mp3Loc;
		console.log(mp3Folder);

		var deferred = $q.defer();

		window.resolveLocalFileSystemURL(mp3Folder, function(dir) {
			var reader = dir.createReader();
			//read it
			reader.readEntries(function(entries) {
					console.log("readEntries");
					console.dir(entries);

					var data = [];

					var process = function(index, cb) {
						var entry = entries[index];
						var name = entry.name;
						entry.file(function(file) {

							ID3.loadTags(entry.name,function() {
								var tags = ID3.getAllTags(name);
								//default to filename
								var title = entry.name;
								if(tags.title) title = tags.title;
								//for now - not optimal to include music here, will change later
								data.push({name:title, tags:tags, url:mp3Loc+entry.name});
								if(index+1 < entries.length) {
									process(++index, cb);
								} else {
									cb(data);
								}
							},{
								dataReader:FileAPIReader(file)
							});

						});

					};

					process(0, function(data) {
						console.log("Done processing");
						console.dir(data[0]);
						items = data;
						// New logic - now we get album art
						var defs = [];
						//remember artist + album
						var albums = {};
						
						for(var i=0;i<items.length;i++) {
							var album = items[i].tags.album;
							var artist = items[i].tags.artist;
							console.log("album="+album+" artist="+artist);
							if(albums[album+" "+artist]) {
								console.log("get from album cache");
								var def =  $q.defer();
								def.resolve({cache:album+" "+artist});
								defs.push(def.promise);
							} else {
								albums[album+" "+artist] = 1;
								defs.push($http.get("http://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist="+encodeURI(artist)+"&album="+encodeURI(album)+"&api_key=561a7281014565990be9aad2827e0253&format=json"));
							}
						}
						$q.all(defs).then(function(res) {
							console.log("in the q all");
							for(var i=0;i<res.length;i++) {
								console.log(i, res[i]);
								//if we marked it as 'from cache', check cache
								if(res[i].cache) {
									console.log('setting from cache '+albums[res[i].cache])
									items[i].image = albums[res[i].cache];
								} else {
									var result = res[i].data;
									//potential match at result.album.image
									if(result.album && result.album.image) {
										items[i].image = result.album.image[3]["#text"];
									} else {
										items[i].image = "";
									}
									albums[items[i].tags.album+" "+items[i].tags.artist] = items[i].image;
								}
							}
							
							deferred.resolve(items);
						});
					});


			});

		}, function(err) {
			deferred.reject(err);
		});


		return deferred.promise;
		
	}

	function getOne(id) {
		var deferred = $q.defer();
		deferred.resolve(items[id]);

		return deferred.promise;
	}

	var media;
	function play(l) {
		if(media) { media.stop(); media.release(); }
		media = new Media(l,function() {}, function(err) { console.dir(err);});
		media.play();
	}
	
	return {
		getAll:getAll,
		getOne:getOne,
		play:play
	};
  
});
