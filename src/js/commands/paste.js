
elFinder.prototype.commands.paste = function() {

	this.title = 'Paste files';

	this.handlers = {
		changeclipboard : function() { this.update(); }
	}

	this.shortcuts = [{
		pattern     : 'ctrl+v shift+insert',
		description : 'Paste files'
	}];
	
	this.getstate = function() {
		return 0
		return this.fm.clipboard().length && this.fm.cwd().write ? 0 : -1;
	}
	
	this.exec = function(dst) {
		var fm = this.fm;
		var d = this._exec(dst)
			.fail(function(error) {
				fm.log('error').log(error)
			})
			.done(function() {
				// fm.log('data').log(arguments)
			})
		
		return d
	}
	
	this._exec = function(dst) {
		var fm     = this.fm,
			errors = fm.errors,
			dst    = dst ? fm.file(dst) : fm.cwd(),
			files  = fm.clipboard(),
			cnt    = files.length,
			cut    = cnt ? files[0].cut : false,
			fpaste = [],
			fcopy  = [],
			dfrd   = $.Deferred()
				.fail(function(error) {
					error && fm.error(error)
				}),
			copy = function(files) {
				return files.length && fm._commands.duplicate
					? fm.exec('duplicate', files)
					: $.Deferred().resolve();
			},
			paste = function(files) {
				var dfrd      = $.Deferred(),
					existed   = [],
					intersect = function(files, names) {
						var ret = [], 
							i   = files.length;

						while (i--) {
							$.inArray(files[i].name, names) !== -1 && ret.unshift(i);
						}
						return ret;
					},
					confirm   = function(ndx) {
						var i    = existed[ndx],
							file = files[i],
							last = ndx == existed.length-1;

						if (!file) {
							return;
						}

						fm.confirm({
							title  : 'Move file',
							text   : 'File '+file.name+' exists. Replace',
							all    : !last,
							accept : {
								label    : 'Replace',
								callback : function(all) {
									!last && !all
										? confirm(++ndx)
										: paste(files);
								}
							},
							reject : {
								label    : 'No',
								callback : function(all) {
									var i;

									if (all) {
										i = existed.length;
										while (ndx < i--) {
											files[existed[i]].remove = true
										}
									} else {
										files[existed[ndx]].remove = true;
									}

									!last && !all
										? confirm(++ndx)
										: paste(files);
								}
							},
							cancel : {
								label    : 'Cancel',
								callback : function() {
									dfrd.resolve();
								}
							}
						})
					},
					valid     = function(names) {
						existed = intersect(files, names);
						if (existed.length) {
							confirm(0);
						} else {
							paste(files);
						}
					},
					paste     = function(files) {
						var files  = $.map(files, function(file) { return !file.remove ? file : null } ),
							cnt    = files.length,
							groups = {},
							args   = [];

						if (!cnt) {
							return dfrd.resolve();
						}


						if (fm.oldAPI) {
							$.each(files, function(i, file) {
								if (!groups[file.phash]) {
									groups[file.phash] = [];
								}

								groups[file.phash].push(file.hash);
							});

							$.each(groups, function(src, targets) {
								args.push(function() {
									return fm.ajax({
										data   : {cmd : 'paste', current : fm.cwd().hash, src : src, dst : dst.hash, targets : targets, cut : cut ? 1 : 0},
										notify : {type : cut ? 'move' : 'copy', cnt : targets.length}
									});
								});
							});

							fm.waterfall.apply(null, args)
								.fail(function(error) {
									dfrd.reject(error);
								})
								.done(function() {
									dfrd.resolve.apply(dfrd, Array.prototype.slice.apply(arguments));
								})

						}

					}
					;
				
				if (files.length) {
					if (dst.hash == fm.cwd().hash) {
						valid($.map(fm.files(), function(file) { return file.phash == dst.hash ? file.name : null }));
					} else {

					}
				} else {
					dfrd.resolve();
				}
				
				
				return dfrd;
			},
			parents, i, file
			;

		if (!cnt) {
			return dfrd.reject('There are no files in clipboard to paste');
		}
			
		if (!dst) {
			return dfrd.reject('Destination directory not defined.');
		}

		if (dst.mime != 'directory') {
			return dfrd.reject([errors.notDir, dst.name]);
		}
		
		if (!dst.write)	{
			return dfrd.reject(['Unable paste files because you do not have permissions to write in "$1"', dst.name])
		}
		
		parents = fm.parents(dst.hash);

		for (i = 0; i < cnt; i++) {
			file = files[i];
			if ($.inArray(file.hash, parents) !== -1) {
				return dfrd.reject(['Unable to copy "$1" into itself or in child folder', file.name])
			}
			if (!file.read) {
				return dfrd.reject([notCopy, file.name]);
			}
			if (cut && file.locked) {
				return dfrd.reject([fileLocked, file.name])
			}

			if (file.phash == dst.hash) {
				fcopy.push(file.hash);
			} else {
				fpaste.push({
					hash  : file.hash,
					phash : file.phash,
					name  : file.name
				});
			}
		}
		
		// to avoid error message duplicate
		// dfrd = $.Deferred();
		
		return $.when(
			copy(fcopy),
			paste(fpaste)
		);
	}

}