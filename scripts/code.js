/**
 *
 * (c) Copyright VNexsus 2025
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
(function(window, undefined){

	let state = { from: null, to: null };

	var THUMB_BASE_W = 300;
	var THUMB_BASE_H = (parent && parent.Asc && parent.Asc.FONT_THUMBNAIL_HEIGHT) || 28;
	var systemViewLocked = true;
	var fontThumbnailsBinary = null;
	var fontThumbnailsBinaryMask = null;
	var recalcId = null;
	
	var theme = "light";

	function getThumbScale() {
		var s = (parent && parent.AscCommon && parent.AscCommon.retinaPixelRatio) || (window.devicePixelRatio || 1);
		if (s >= 1.875) return 2;
		if (s >= 1.625) return 1.75;
		if (s >= 1.375) return 1.5;
		if (s >= 1.125) return 1.25;
		return 1;
	}
	
	function getBinThumbSpritePath(scale) {
		switch (scale) {
			case 1.25:
				return parent.Common.Controllers.Desktop.call('getFontsSprite', '@1.25x');
			case 1.5:
				return parent.Common.Controllers.Desktop.call('getFontsSprite', '@1.5x');
			case 1.75:
				return parent.Common.Controllers.Desktop.call('getFontsSprite', '@1.75x');
            case 2:
				return parent.Common.Controllers.Desktop.call('getFontsSprite', '@2x');
			default:
				return parent.Common.Controllers.Desktop.call('getFontsSprite');
		}
	}
	
	window.Asc.plugin.init = function() {
		document.body.classList.add(window.Asc.plugin.getEditorTheme());
		window.Asc.plugin.resizeWindow(600, 250, 600, 250, 800, 450);
		ensureUI();
		loadBinFonts();
		recalcId = parent.editor.getLogicDocument().RecalcId; 
	};

	window.Asc.plugin.onExternalMouseUp = function() {
        var evt = document.createEvent("MouseEvents");
        evt.initMouseEvent("mouseup", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        document.dispatchEvent(evt);
		
		var result = parent.editor.getLogicDocument().RecalcId;
		if(recalcId != result) {
			recalcId = result;
			collectFonts(true);
		}
    };



	window.Asc.plugin.onThemeChanged = function(theme) {
		window.Asc.plugin.onThemeChangedBase(theme);
		document.body.classList.remove("theme-dark", "theme-light");
		document.body.classList.add(window.Asc.plugin.getEditorTheme());
		if(fontThumbnailsBinary){
			createBinFontsMask();
			rebuildFonts();
		}
	}

	window.Asc.plugin.getEditorTheme = function(){
		if(window.localStorage && window.localStorage.getItem("ui-theme")){
			var x = JSON.parse(window.localStorage.getItem("ui-theme"));
			theme = x.type;
			return 'theme-' + x.type;
		}
		theme = 'light';
		return "theme-light";
	}

	function loadBinFonts() {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', getBinThumbSpritePath(getThumbScale()) + ".bin", true);
		xhr.responseType = 'arraybuffer';
		if (xhr.overrideMimeType)
			xhr.overrideMimeType('text/plain; charset=x-user-defined');
		else
			xhr.setRequestHeader('Accept-Charset', 'x-user-defined');
		xhr.onload = function() {
			systemViewLocked = false;
			fontThumbnailsBinary = new Uint8Array(this.response);
			createBinFontsMask();
			collectFonts();
			renderAllFonts(Object.keys(parent.AscFonts.g_map_font_index) || []);
		};
		xhr.onerror = function() {
			systemViewLocked = true;
			collectFonts();
			renderAllFonts(Object.keys(parent.AscFonts.g_map_font_index) || []);
		}
		xhr.send(null);
	}


	function createBinFontsMask() {
		var binaryAlpha = new Uint8Array(fontThumbnailsBinary);
		width      = (binaryAlpha[0] << 24) | (binaryAlpha[1] << 16) | (binaryAlpha[2] << 8) | (binaryAlpha[3] << 0);
		heightOne  = (binaryAlpha[4] << 24) | (binaryAlpha[5] << 16) | (binaryAlpha[6] << 8) | (binaryAlpha[7] << 0);
		count      = (binaryAlpha[8] << 24) | (binaryAlpha[9] << 16) | (binaryAlpha[10] << 8) | (binaryAlpha[11] << 0);
		height     = count * heightOne;
		THUMB_BASE_W = width;
		THUMB_BASE_H = heightOne;
		var memorySize = 4 * width * height;
		fontThumbnailsBinaryMask = new Uint8ClampedArray(memorySize);
		var binaryIndex = 12;
		var binaryLen = binaryAlpha.length;
		var index = 0;
		var len0 = 0;
		var tmpValue = 0;
		var imagePixels = fontThumbnailsBinaryMask;
		while (binaryIndex < binaryLen) {
			tmpValue = binaryAlpha[binaryIndex++];
			if (0 == tmpValue) {
				len0 = binaryAlpha[binaryIndex++];
				while (len0 > 0) {
					len0--;
					imagePixels[index] = imagePixels[index + 1] = imagePixels[index + 2] =  (theme == 'light') ? 255 : tmpValue;
					imagePixels[index + 3] = 0; 
					index += 4;
				}
			} 
			else {
				imagePixels[index] = imagePixels[index + 1] = imagePixels[index + 2] = (theme == 'light') ? 255 - tmpValue : 255;
				imagePixels[index + 3] = tmpValue;
				index += 4;
			}
		}
	}


	async function getFontSampleBin(fontName) {
		if(!parent.AscFonts.g_font_infos[parent.AscFonts.g_map_font_index[fontName]])
			throw new Error("Font '"+ fontName +"' is not found on target system");
		var fontIndex = parent.AscFonts.g_font_infos[parent.AscFonts.g_map_font_index[fontName]].Thumbnail;
		canvas = document.createElement("canvas");
		canvas.width = THUMB_BASE_W;
		canvas.height = THUMB_BASE_H;
		canvas.style.width = "300px";
		canvas.style.height = "28px";
		ctx = canvas.getContext("2d");
		var dataTmp = ctx.createImageData(THUMB_BASE_W, THUMB_BASE_H);
		var sizeImage = 4 * THUMB_BASE_W * THUMB_BASE_H;
		dataTmp.data.set(new Uint8ClampedArray(fontThumbnailsBinaryMask.buffer, fontIndex * sizeImage, sizeImage));                        
		ctx.putImageData(dataTmp, 0, 0);
		return canvas;
	}


	function rebuildFonts(){
		var used = byId('usedFontsList');
		for(var i = 0; i < used.children.length; i++) {
			let div = used.children[i];
			if(div.classList.contains('font-item')){
				let fontName = (div.dataset && div.dataset.name) ? div.dataset.name : (div.getAttribute ? div.getAttribute('data-name') : null);
				div.innerHTML = '';
				if (!systemViewLocked) {
					let sample = getFontSampleBin(fontName);
					sample.then((canvas) => {
						div.appendChild(canvas);
					}).catch(function(){
						let warning = document.createElement("div");
						warning.className = "icon warning";
						let name = document.createElement("div");
						name.className = "font-name";
						name.textContent = fontName;
						div.appendChild(warning);
						div.appendChild(name);
					});
				} else {
					var sample = document.createElement("div");
					sample.className = "font-name";
					sample.textContent = fontName;
					div.appendChild(sample);
				}
			}
		}
		var all = byId('allFontsList');
		for(var i = 0; i < all.children.length; i++) {
			let div = all.children[i];
			if(div.classList.contains('font-item')){
				let fontName = (div.dataset && div.dataset.name) ? div.dataset.name : (div.getAttribute ? div.getAttribute('data-name') : null);
				div.innerHTML = '';
				if (!systemViewLocked) {
					let sample = getFontSampleBin(fontName);
					sample.then((canvas) => {
						div.appendChild(canvas);
					}).catch(function(){
						let warning = document.createElement("div");
						warning.className = "icon warning";
						let name = document.createElement("div");
						name.className = "font-name";
						name.textContent = fontName;
						div.appendChild(warning);
						div.appendChild(name);
					});
				} else {
					var sample = document.createElement("div");
					sample.className = "font-name";
					sample.textContent = fontName;
					div.appendChild(sample);
				}
			}
		}
	}

	function ensureUI(){
		var grid = byId('fontsList');
		var uBox = byId('leftBox');
		var uSearch = byId('usedSearchBox');
		var uList = byId('usedFonts');
		var used = byId('usedFontsList');

		var btn = byId('replaceBtn');
		btn.onclick = function(e){ try{e.preventDefault(); e.stopPropagation();}catch(_){ } onReplace(false); };

		var cancel = byId('cancelBtn');
		cancel.onclick = function(e){ try{e.preventDefault(); e.stopPropagation();}catch(_){ } try{ window.Asc.plugin.executeCommand("close", ""); }catch(__){} };

		var aBox = byId('rightBox');
		var aSearch = byId('availableSearchBox');
		var all = byId('allFontsList');
		var aList = byId('availableFonts');

		var tip = document.createElement('div');
		tip.className = 'tooltip';
		document.body.appendChild(tip);

		var visible = false;

		function show(text, x, y){
			if (!text) return;
			tip.textContent = text;
			tip.classList.add('show');
			visible = true;
			position(x, y);
		}

		function hide(){ if (!visible) return; tip.classList.remove('show'); visible = false; }

		function position(x, y){
			var pad = 12, vw = window.innerWidth||1000, vh = window.innerHeight||800;
			var rect = tip.getBoundingClientRect();
			var left = x + pad, top = y + pad;
			if (left + rect.width + pad > vw) left = Math.max(4, x - rect.width - pad);
			if (top + rect.height + pad > vh) top = Math.max(4, y - rect.height - pad);
			tip.style.left = left + 'px'; tip.style.top = top + 'px';
		}

		function getTextFromTarget(t){
            if (!t) return null;

            var it = t.closest ? t.closest('.font-item') : t;
            var d = (it && it.dataset && it.dataset.name) ? it.dataset.name : (it && it.getAttribute ? it.getAttribute('data-name') : null);
            if (d && d.trim)
				return it.children && it.children.length > 1 && it.children[0].classList.contains('warning') ? "Нет на этом ПК: "+ d.trim() : d.trim();

            var n = it && it.querySelector ? it.querySelector('.font-name') : null;
            var text = n ? n.textContent : (it && it.textContent ? it.textContent : '');
            return (text||'').trim();
        }

		document.addEventListener('mousemove', function(e){
			var t = e.target.closest && e.target.closest('.font-item, .font-name');
			if (!t){ hide(); return; }
			var text = getTextFromTarget(t);
			if (!text){ hide(); return; }
			show(text, e.clientX, e.clientY);
		});

		document.addEventListener('mouseleave', hide, true);

		function attachFilter(input, container){
			if (!input || !container) return;
			
			var clear = input.nextElementSibling;
			clear.addEventListener('click', function(){
				input.value = '';
				input.focus();
				input.dispatchEvent(new Event('input'));
				clear.style.display = 'none';
			});
			
			input.addEventListener('input', function(){
				var q = (input.value || '').toLowerCase();
				var items = container.querySelectorAll('.font-item');
				var anySelectedHidden = false;
				var count = 0, last = null, lastName = null;
				container.querySelectorAll('.stub').forEach(el => {el.remove()});
				for(var i = 0; i < items.length; i++) {
					var t = (items[i].textContent || items[i].getAttribute("data-name") ||'').toLowerCase();
					if(q && t.indexOf(q) === -1){
						items[i].style.display = 'none';
						if(items[i].classList.contains('selected'))
							items[i].classList.remove('selected'), 
							state[container.id == 'usedFontsList' ? 'from' : 'to'] = null,
							byId('replaceBtn').disabled = true;
					}
					else
						items[i].style.display = '', count++, last = i, lastName = items[i].getAttribute("data-name")
						q && (clear.style.display = 'block');
					
				}
				if(count == 1 && last >= 0)
					items[last].classList.add('selected'), 
					state[container.id == 'usedFontsList' ? 'from' : 'to'] = lastName,
					byId('replaceBtn').disabled = !(state.from && state.to);
				if(q && count == 0)
					container.appendChild(getStub('Совпадений не найдено'));
				else if(items.length == 0)
					container.appendChild(getStub('Нет элементов для отображения'));
				if(q.length > 0)
					clear.style.display = 'block';
				else
					clear.style.display = 'none';
			});
		}

		attachFilter(uSearch, used);
		attachFilter(aSearch, all);

		uList.addEventListener('click', function(e){
            var it = e.target.closest('.font-item'); if (!it) return;
            var name = (it.dataset && it.dataset.name) || (it.getAttribute && it.getAttribute('data-name')) || ((it.querySelector('.font-name') || it).textContent || '').trim();
            if (!name) return;
			state.from = name;
			markSelected(uList, it);
			var b = byId('replaceBtn');
			if (b)
				b.disabled = !(state.from && state.to);
		});
	}

	function renderFont(list, fontName) {
		if (!list) return;
		let div = document.createElement("div");
		div.className = "font-item";
		try { div.removeAttribute('title'); } catch(_) {}
		div.setAttribute("data-name", fontName);
		if (!systemViewLocked) {
			let sample = getFontSampleBin(fontName);
			sample.then((cnv) => {
				div.appendChild(cnv);
			}).catch(function(){
				let warning = document.createElement("div");
				warning.className = "icon warning";
				let name = document.createElement("div");
				name.className = "font-name";
				name.textContent = fontName;
				div.appendChild(warning);
				div.appendChild(name);
			});
		} else {
			var sample = document.createElement("div");
			sample.className = "font-name";
			sample.textContent = fontName;
			div.appendChild(sample);
		}
		list.appendChild(div);
	}

	async function renderAllFonts(list){
		var all = byId('allFontsList');
		if (!all) return;
		all.innerHTML = "";
		list.forEach(function(font){
			if(font != 'ASCW3')
				renderFont(all, font);
		});
		all.addEventListener('click', function(e){
            var it = e.target.closest('.font-item');
			if (!it) return;
            var name = (it.dataset && it.dataset.name) || it.getAttribute && it.getAttribute('data-name') || ((it.querySelector('.font-name') || it).textContent || '').trim();
            if (!name) return;
			state.to = name;
			markSelected(all, it);
			var b = byId('replaceBtn');
			if (b)
				b.disabled = !(state.from && state.to);
		});
	}

	function renderFontsList(fonts){
		var root = byId("usedFontsList");
		if (!root) return;
		root.innerHTML = "";
		(fonts || []).forEach(function(font){
		  if(font != 'ASCW3')
			renderFont(root, font);
		});
		if(state.from) {
			var items = root.querySelectorAll('.font-item');
			items.forEach(function(item) { 
				item.classList.remove('selected');
				if((item.dataset && item.dataset.name === state.from) || (item.textContent && item.textContent.trim() === state.from)){
					item.classList.add('selected');
					item.scrollIntoView({behavior: 'smooth', block: 'center'});
				}
			});
		}
	}

	function collectFonts(force){
		window.Asc.plugin.callCommand(function () {

			function add(name){
				if (name)
					seen[String(name)] = true;
			}

			function getFamFromTextPr(tp){
				try {
					if (!tp) return null;
					if (tp.GetFontFamily) { var ff = tp.GetFontFamily(); if (ff) return ff; }
					if (tp.GetFontName)   { var fn = tp.GetFontName();   if (fn) return fn; }
				} catch(e){}
				return null;
			}

			function hasNonWhitespaceText(node){
				try { if (node && node.GetText) { var t = node.GetText(); if (t && /\S/.test(String(t))) return true; } } catch(_){}
				try { if (node && node.GetTextContent) { var tc = node.GetTextContent(); if (tc && /\S/.test(String(tc))) return true; } } catch(_){}
				try { if (node && node.get_Text) { var t2 = node.get_Text(); if (t2 && /\S/.test(String(t2))) return true; } } catch(_){}
				return false;
			}

			function isPlaceholderText(s){
				if (!s) return false;
				s = String(s).trim().toLowerCase();
				var patterns = [
					/^заголовок слайда$/, /^текст слайда$/, /^заголовок$/, /^подзаголовок$/,
					/^нажмите, чтобы добавить заголовок$/, /^нажмите, чтобы добавить текст$/,
					/^click to add title$/, /^click to add subtitle$/, /^click to add text$/,
					/^щёлкните, чтобы добавить заголовок$/, /^щёлкните, чтобы добавить текст$/,
					/^add title$/, /^add text$/, /^текст$/
				];
				for (var i=0;i<patterns.length;i++){ if (patterns[i].test(s)) return true; }
				return false;
			}

			function isRealUserText(s){
				if (!s) return false;
				s = String(s).replace(/\s+/g,' ').trim();
				if (!s) return false;
				if (/^[•●◦▪▫··\-–—.,:;!?()\[\]{}<>]+$/.test(s)) return false;
				if (/[A-Za-z0-9\u0400-\u04FF]/.test(s)) return true;
				return false;
			}

			function resolveThemeAlias(name){
				if (!name) return name;
				var s = String(name);
				if (s.charAt(0) === '+') {
					if (s.indexOf('mn-lt') >= 0 && themeMinorLatin) return themeMinorLatin;
					if (s.indexOf('mj-lt') >= 0 && themeMajorLatin) return themeMajorLatin;
				}
				return name;
			}


			var pres = Api.GetPresentation();
			var slidesCount = (pres && pres.GetSlidesCount && pres.GetSlidesCount()) || 0;
			var seen = {};
			var defaultFontUsed = false;
			var defaultFont = null;

			for (var i = 0; i < slidesCount; i++) {
				var slide = pres.GetSlideByIndex(i);
				// shapes
				var shapes = (slide && slide.GetAllShapes && slide.GetAllShapes()) || [];
				for (var s = 0; s < shapes.length; s++) {
					var sh = shapes[s];
					var content = sh && sh.GetDocContent && sh.GetDocContent();
					if (!content) continue;
					var ec = 0;
					try { ec = content.GetElementsCount(); } catch (e) { ec = 0; }
					for (var eIdx = 0; eIdx < ec; eIdx++) {
						var el = content.GetElement(eIdx);
						if (!el) continue;
						var rc = 0;
						try { rc = el.GetElementsCount(); } catch (e) { rc = 0; }
						for (var r = 0; r < rc; r++) {
							var run = el.GetElement(r);
							if (!run) continue;
							var txt = null; try { txt = run.GetText && run.GetText(); } catch(e) {}
							var ok = txt && isRealUserText(txt) && !isPlaceholderText(txt);
							if (!ok) continue;
							var addedExplicit = false;
							try {
								if (run.GetFontNames) {
									var names = run.GetFontNames();
									if(names.length == 0) 
										names = ['Arial'];
									var resolvedDefaultFont = resolveThemeAlias(defaultFont) || defaultFont;
									var first = names[0];
									var firstStr = String(first||'');
									var firstRes = resolveThemeAlias(first) || first;
									if (firstStr.charAt(0) !== '+' && firstRes && firstRes !== resolvedDefaultFont) {
										add(firstRes);
										addedExplicit = true;
									}
									else
										addedExplicit = false;
								}
							} catch(_){}
							if (!addedExplicit){
								var fam = null;
								try { if (run.GetFontFamily) fam = run.GetFontFamily(); } catch(_){}
								if (!fam) { try { if (run.GetFontName) fam = run.GetFontName(); } catch(_){ } }
								if (!fam) { try { fam = getFamFromTextPr(run.GetTextPr && run.GetTextPr()); } catch(_){ } }
								if (fam) {
									var famStr = String(fam||'');
									var famResolved = resolveThemeAlias(fam) || fam;
									var resolvedDefaultFont = resolveThemeAlias(defaultFont) || defaultFont;
									// Не считаем шрифты темы/по умолчанию: пропускаем алиасы (+mn-lt/+mj-lt)
									if (famStr.charAt(0) !== '+' && famResolved && famResolved !== resolvedDefaultFont) {
										add(famResolved);
									} 
									else 
										defaultFontUsed = true;
								}
								else 
									defaultFontUsed = true;
							}
						}
					}
				}
				// tables
				var drawings = (slide && slide.GetAllDrawings && slide.GetAllDrawings()) || []
				for (var d = 0; d < drawings.length; d++) {
					if(drawings[d].Drawing) {
						var drawing = drawings[d].Drawing;
						var tables = (drawing.GetElement && drawing.GetElement().GetAllTables && drawing.GetElement().GetAllTables()) || [];
						for(var t = 0; t < tables.length; t++) {
							var table = tables[t];
							var paras = table.GetAllParagraphs();
							for(var p = 0; p < paras.length; p++) {
								for( var e = 0; e < paras[p].GetElementsCount(); e++) {
									var el = paras[p].GetElement(e);
									add(el.Pr.Get_FontFamily() || 'Arial');
								}
							}
						}
					}
				}
				// charts
				var charts = (slide && slide.GetAllCharts && slide.GetAllCharts()) || [];
				for(var c = 0; c < charts.length; c++) {
					var chart = charts[c];
					// titles
					var titles = chart.Chart.getAllTitles();
					for(var t = 0; t < titles.length; t++) {
						var title = titles[t];
						var content = title.getDocContent();
						for(var x = 0; x < content.GetElementsCount(); x++) {
							var para = content.GetElement(x);
							for(var r = 0; r < para.GetElementsCount(); r++) {
								var run = para.GetElement(r);
								add(run.CompiledPr.FontFamily.Name);
							}
						}
					}
					// legend
					var legend = chart.Chart.getLegend();
					var entries = legend.calcEntryes;
					for(var e = 0; e < entries.length; e++) {
						var content = entries[e].txBody.content.Content;
						for(var p = 0; p < content.length; p++) {
							var para = content[p];
							for(var r = 0; r < para.GetElementsCount(); r++) {
								var run = para.GetElement(r);
								add(run.CompiledPr.FontFamily.Name);
							}
						}
					}
					// axes
					var axes = chart.Chart.getAllAxes();
					for(var a = 0; a < axes.length; a++) {
						if(axes[a].labels && axes[a].labels.aLabels) {
							var labels = axes[a].labels.aLabels;
							for(var l = 0; l < labels.length; l++) {
								var content = labels[l].getDocContent();
								for(var p = 0; p < content.GetElementsCount(); p++) {
									var para = content.GetElement(p);
									for(var r = 0; r < para.GetElementsCount(); r++) {
										var run = para.GetElement(r);
										add(run.CompiledPr.FontFamily.Name);
									}
								}
							}
						}
					}
					// data labels
					var allseries = chart.Chart.getAllSeries();
					for(var s = 0; s < allseries.length; s++) {
						var series = allseries[s];
						var points = series.getNumPts && series.getNumPts() || [];
						for(var p = 0; p < points.length; p++) {
							if(points[p].compiledDlb) {
								var content = points[p].compiledDlb.getDocContent();
								for(var j = 0; j < content.GetElementsCount(); j++) {
									var para = content.GetElement(j);
									for(var r = 0; r < para.GetElementsCount(); r++) {
										var run = para.GetElement(r);
										add(run.CompiledPr.FontFamily.Name);
									}
								}
							}
						}
					}
				}
			}
			var list = Object.keys(seen).sort();
			return list.join("\n");
		}, false, false, function (result) {
			var arr = (result || "").split(/\n/).filter(Boolean);
			if(arr.length == 0){
				var list = byId("usedFontsList");
				list.innerHTML = '';
				list.appendChild(getStub('Нет элементов для отображения'));
			}
			else{
				if(force)
					state.from = state.to;
				renderFontsList(arr);
			}
		});
	}

	function onReplace(){
		if (!state.from || !state.to) 
			return; 
		
		window.Asc.scope = { FROM: state.from, TO: state.to};

		window.Asc.plugin.callCommand(function(){
			var FROM = Asc.scope.FROM, TO = Asc.scope.TO;
			var fromN = (FROM||'');
			var fromNorm = fromN.toLowerCase().replace(/[\s_-]+/g,'');
			var toN = (TO||'');
			var changed = 0;

			var themeMinorLatin = null, themeMajorLatin = null;
			try {
				var pres = Api.GetPresentation && Api.GetPresentation();
				if (pres && pres.GetTheme) {
					var th = pres.GetTheme();
					if (th && th.GetFontScheme) {
						var fs = th.GetFontScheme();
						try { var mn = fs.GetMinorFont && fs.GetMinorFont(); if (mn && mn.GetLatin) { var lat = mn.GetLatin(); if (lat) { themeMinorLatin = (lat.GetTypeface && lat.GetTypeface()) || lat.typeface || null; } } } catch(_){}
						try { var mj = fs.GetMajorFont && fs.GetMajorFont(); if (mj && mj.GetLatin) { var lat2 = mj.GetLatin(); if (lat2) { themeMajorLatin = (lat2.GetTypeface && lat2.GetTypeface()) || lat2.typeface || null; } } } catch(_){}
					}
				}
			} catch(_){}

			function resolveAlias(name){
				if (!name) return name;
				var s = String(name);
				if (s.charAt(0) === '+') {
					if (s.indexOf('mn-lt') >= 0 && themeMinorLatin) return themeMinorLatin;
					if (s.indexOf('mj-lt') >= 0 && themeMajorLatin) return themeMajorLatin;
				}
				return name;
			}

			var detectedDefaultFont = null;
			try {
				var dtp = Api.GetDefaultTextPr && Api.GetDefaultTextPr();
				if (dtp) {
					try { if (typeof dtp.GetFontName==='function' && dtp.GetFontName()) detectedDefaultFont = dtp.GetFontName(); } catch(_){}
					if (!detectedDefaultFont) { try { if (typeof dtp.GetFontFamily==='function' && dtp.GetFontFamily()) detectedDefaultFont = dtp.GetFontFamily(); } catch(_){ } }
				}
			} catch(_){}

			if (!detectedDefaultFont) { detectedDefaultFont = (themeMinorLatin || themeMajorLatin) || null; }
			var detectedDefaultNorm = detectedDefaultFont ? String(detectedDefaultFont).toLowerCase().replace(/[\s_-]+/g,'') : '';

			function isPlaceholderText(s){
				if (!s) return false;
				s = String(s).trim().toLowerCase();
				var patterns = [
					/^заголовок слайда$/, /^текст слайда$/, /^заголовок$/, /^подзаголовок$/,
					/^нажмите, чтобы добавить заголовок$/, /^нажмите, чтобы добавить текст$/,
					/^click to add title$/, /^click to add subtitle$/, /^click to add text$/,
					/^щёлкните, чтобы добавить заголовок$/, /^щёлкните, чтобы добавить текст$/,
					/^add title$/, /^add text$/, /^текст$/
				];
				for (var i=0;i<patterns.length;i++){ if (patterns[i].test(s)) return true; }
				return false;
			}

			function nameOfRun(run){
				try { if (run.GetFontName) return run.GetFontName(); } catch(e){}
				try { if (run.GetFontFamily) return run.GetFontFamily(); } catch(e){}
				try { var tp = run.GetTextPr && run.GetTextPr(); if (tp && tp.GetFontName) return tp.GetFontName(); if (tp && tp.GetFontFamily) return tp.GetFontFamily(); } catch(e){}
				return null;
			}

			function setRun(run, name){
				var tp = null; try { tp = run.GetTextPr && run.GetTextPr(); } catch(e){}
				if (!tp && typeof Api!=='undefined' && Api.CreateTextPr){ try { tp = Api.CreateTextPr(); } catch(e){} }
				if (!tp) return false;
				var ok=false;
				try { if (tp.SetFontName){ tp.SetFontName(name); ok=true; } } catch(e){}
				if (!ok){ try { if (tp.SetFontFamily){ tp.SetFontFamily(name); ok=true; } } catch(e){} }
				if (ok){ try { run.SetTextPr && run.SetTextPr(tp); changed++; return true; } catch(e){} }
				return false;
			}
			
			function setPara(para, name) {
				var tp = Api.CreateTextPr();
				if (tp.SetFontName) tp.SetFontName(name);
				if (tp.SetFontFamily) tp.SetFontFamily(name);
				tp.TextPr.FontFamily = {Name: name, Index: -1};
				para.Apply_TextPr(tp, true, true);
			}

			function setElDefault(el, name){
				try {
					if (el.SetFontName){ el.SetFontName(name); changed++; return true; }
				} catch(e){}
				try {
					var tp = el.GetTextPr && el.GetTextPr();
					if (!tp && Api && Api.CreateTextPr) tp = Api.CreateTextPr();
					if (tp){
						var ok=false;
						try { if (tp.SetFontName){ tp.SetFontName(name); ok=true; } } catch(e){}
						if (!ok){ try { if (tp.SetFontFamily){ tp.SetFontFamily(name); ok=true; } } catch(e){} }
						if (ok && el.SetTextPr){ el.SetTextPr(tp); changed++; return true; }
					}
				} catch(e){}
				return false;
			}

			function setShapeDefault(sh, name){
				try {
					var tp = sh.GetTextPr && sh.GetTextPr();
					if (!tp && Api && Api.CreateTextPr) tp = Api.CreateTextPr();
					if (tp){
						var ok=false;
						try { if (tp.SetFontName){ tp.SetFontName(name); ok=true; } } catch(e){}
						if (!ok){ try { if (tp.SetFontFamily){ tp.SetFontFamily(name); ok=true; } } catch(e){} }
						if (ok && sh.SetTextPr){ sh.SetTextPr(tp); changed++; return true; }
					}
				} catch(e){}
				return false;
			}

			function match(name){
				if (!name){
					if (detectedDefaultNorm)
						return detectedDefaultNorm === fromNorm;
					return fromNorm === 'arial';
				}
				var a = String(name).toLowerCase().replace(/[\s_-]+/g,'');
				return a === fromNorm;
			}

			function replaceObjFont(obj, textPr, drawingDocument) {
				AscFormat.CheckObjectTextPr(obj, textPr, drawingDocument);
				Api.checkChangesSize();
			}

			function processSlide(slide, includeImplicit){
				// shapes
				var shapes = slide.GetAllShapes();
				for (var s=0; s<shapes.length; s++){
					var sh = shapes[s];
					var dc = sh.GetDocContent && sh.GetDocContent();
					if (!dc) continue;
					var ec = 0; try { ec = dc.GetElementsCount(); } catch(e){}
					for (var i = 0; i < ec; i++){
						var el = dc.GetElement(i);
						if (!el) continue;
						var rc = 0; try { rc = el.GetElementsCount(); } catch(e){}
						for(var r = 0; r < rc; r++){
							var run = el.GetElement(r);
							if (!run) continue;
							try {
								var rn = run.GetFontNames()[0];
								var rtxt = null; try { rtxt = run.GetText && run.GetText(); } catch(e){}
								if ((rn && match(rn)) || (includeImplicit && !rn && match(null) && rtxt && /\S/.test(String(rtxt)) && !isPlaceholderText(rtxt)))
								setRun(run, toN);
							} catch(e){}
						}
					}
				}
				// tables
				var drawings = (slide && slide.GetAllDrawings && slide.GetAllDrawings()) || []
				for (var d = 0; d < drawings.length; d++) {
					var drawing = drawings[d].Drawing;
					var tables = (drawing.GetElement && drawing.GetElement().GetAllTables && drawing.GetElement().GetAllTables()) || [];
					for(var t = 0; t < tables.length; t++) {
						var table = tables[t];
						var paras = table.GetAllParagraphs();
						for(var p = 0; p < paras.length; p++) {
							for( var e = 0; e < paras[p].GetElementsCount(); e++) {
								var el = paras[p].GetElement(e);
								if(el.Pr.Get_FontFamily() == fromN || (!el.Pr.Get_FontFamily() && fromN == 'Arial'))
									el.Pr.SetFontFamily(toN), changed++;
							}
						}
					}
				}
				// charts
				var charts = (slide && slide.GetAllCharts && slide.GetAllCharts()) || [];
				var tp = Api.CreateTextPr();
				tp.SetFontFamily(toN);
				for(var c = 0; c < charts.length; c++) {
					const chart = charts[c].Chart;
					// titles
					let titles = chart.getAllTitles();
					for(var t = 0; t < titles.length; t++) {
						var title = titles[t];
						var content = title.getDocContent();
						if(content.GetCalculatedTextPr && content.GetCalculatedTextPr().FontFamily.Name == fromN) {
							replaceObjFont(title, tp.TextPr, chart.getDrawingDocument());
						}
						for(var x = 0; x < content.GetElementsCount(); x++) {
							var para = content.GetElement(x);
							para.SelectAll();
							for(var r = 0; r < para.GetElementsCount(); r++) {
								var run = para.GetElement(r);
								if(run.CompiledPr.FontFamily.Name == fromN){
									run.ApplyFontFamily(toN),
									run.GetText() != '' && changed++;
								}
							}
						}
					}
					// legend
					var legend = chart.getLegend();
					if((legend.txPr.content.Content[0].CompiledPr.Pr && legend.txPr.content.Content[0].CompiledPr.Pr.TextPr.RFonts.Ascii.Name == fromN) || chart.txPr.content.Content[0].GetCalculatedTextPr().FontFamily.Name == fromN) {
						replaceObjFont(legend, tp.TextPr, chart.getDrawingDocument());
					}
					var entries = legend.legendEntryes;
					for(var e = 0; e < entries.length; e++) {
						var entry = entries[e];
						var content = entry.txPr.content.Content;
						for(var p = 0; p < content.length; p++) {
							let para = content[p];
							if(legend.calcEntryes[entry.idx] && legend.calcEntryes[entry.idx].txBody.content.Content[0].GetCalculatedTextPr().FontFamily.Name == fromN) {
								replaceObjFont(entry, tp.TextPr, chart.getDrawingDocument());
								changed++;
							}
						}
					}
					entries = legend.calcEntryes;
					for(var e = 0; e < entries.length; e++) {
						var entry = entries[e];
						var content = entry.txBody.content.Content;
						for(var p = 0; p < content.length; p++) {
							let para = content[p];
							if(para.CompiledPr.Pr.TextPr && para.CompiledPr.Pr.TextPr.RFonts.Ascii.Name == fromN) {
								replaceObjFont(legend, tp.TextPr, chart.getDrawingDocument());
								changed++;
							}
						}
					}
					// axes
					var axes = chart.getAllAxes();
					for(var a = 0; a < axes.length; a++) {
						if(axes[a].labels) {
							var labels = axes[a].labels.aLabels;
							for(var l = 0; l < labels.length; l++) {
								var label = labels[l];
								var content = label.getDocContent();
								if(content.GetCalculatedTextPr && content.GetCalculatedTextPr().FontFamily.Name == fromN) {
									replaceObjFont(label, tp.TextPr, chart.getDrawingDocument());
								}							
								for(var p = 0; p < content.GetElementsCount(); p++) {
									var para = content.GetElement(p);
									for(var r = 0; r < para.GetElementsCount(); r++) {
										var run = para.GetElement(r);
										if(run.CompiledPr.FontFamily.Name == fromN)
											run.ApplyFontFamily(toN),
											run.GetText() != '' && changed++;
									}
								}
							}
						}
					}
					// data labels
					var allseries = chart.getAllSeries();
					for(var s = 0; s < allseries.length; s++) {
						var series = allseries[s];
						var points = series.getNumPts();
						for(var p = 0; p < points.length; p++) {
							if(points[p].compiledDlb) {
								var content = points[p].compiledDlb.getDocContent();
								for(var i = 0; i < content.GetElementsCount(); i++) {
									var para = content.GetElement(i);
									if(para.GetCalculatedTextPr && para.GetCalculatedTextPr().FontFamily.Name == fromN) {
										if(series.dLbls.dLbl && series.dLbls.dLbl.length >= p)
											replaceObjFont(series.dLbls.dLbl[p], tp.TextPr, chart.getDrawingDocument());
										else
											replaceObjFont(series.dLbls, tp.TextPr, chart.getDrawingDocument());
									}
									for(var r = 0; r < para.GetElementsCount(); r++) {
										var run = para.GetElement(r);
										if(run.CompiledPr.FontFamily.Name == fromN)
											run.ApplyFontFamily(toN),
											run.GetText() != '' && changed++;
									}
								}
							}
						}
					}
				}
			}

			var pres = Api.GetPresentation();
			var cnt = pres.GetSlidesCount();

			for (var i=0;i<cnt;i++){ processSlide(pres.GetSlideByIndex(i), true); }
			try { var masters = pres.GetMasterSlides && pres.GetMasterSlides(); if (masters){ for (var m=0;m<masters.length;m++){ processSlide(masters[m], false); } } } catch(e){}
			try { var layouts = pres.GetLayouts && pres.GetLayouts(); if (layouts){ for (var l=0;l<layouts.length;l++){ processSlide(layouts[l], false); } } } catch(e){}
			return changed;

		}, false, true, function(changed){
			byId('usedSearchBox').value = '';
			byId('usedSearchBox').dispatchEvent(new Event('input'));
			byId('replaceBtn').disabled = true;
			window.setTimeout(function(){collectFonts(true)}, 10);
			parent.Common.UI.info({
				title: "Замена завершена",
				msg: `${CorrectTermination("Произведен",["о","а","о","о","о"],changed)} ${changed} ${CorrectTermination("замен",["","а","ы","",""],changed)}`
			});
		});
	}

	function markSelected(contner, item){
		Array.prototype.forEach.call(contner.querySelectorAll('.font-item.selected'), function(el){ el.classList.remove('selected'); });
		if (item) item.classList.add('selected');
	}

	function getStub(msg) {
		var stub = document.createElement("div");
		stub.className = 'stub';
		var contents = document.createElement("span");
		contents.innerText = msg;
		stub.appendChild(contents);
		return stub;
	}

	function CorrectTermination(root, term, count) {
		if (count <= 20 && count >= 10)
			return root + term[4].trim();
		else {
			end = count % 10;
			switch(end){
				case 0:
					return root + term[0].trim();
				case 1:
					return root + term[1].trim();
				case 2:
				case 3:
				case 4:
					return root + term[2].trim();
				default:
					return root + term[3].trim();
			}
		}
	}

	function byId(id){ return document.getElementById(id); }
	function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
	function norm(x){ return (x||"").toLowerCase().replace(/[\s_-]+/g,''); }
	

})(window, undefined);