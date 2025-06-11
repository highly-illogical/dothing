// Browser-compatible version using function constructors instead of ES6 classes
function FrustrationToTasksApp() {
	this.currentMode = 'vent';
	this.tasks = this.loadFromStorage('tasks') || [];
	this.recentVents = this.loadFromStorage('recentVents') || [];
	this.currentFilter = 'all';

	this.init();
}

FrustrationToTasksApp.prototype.init = function () {
	this.bindEvents();
	this.updateUI();
	this.showRecentVents();
};

FrustrationToTasksApp.prototype.bindEvents = function () {
	var self = this;

	// Mode switching
	document
		.getElementById('vent-mode-btn')
		.addEventListener('click', function () {
			self.switchMode('vent');
		});
	document
		.getElementById('action-mode-btn')
		.addEventListener('click', function () {
			self.switchMode('action');
		});

	// Vent mode actions
	document.getElementById('process-btn').addEventListener('click', function () {
		self.processFrustration();
	});
	document.getElementById('clear-btn').addEventListener('click', function () {
		self.clearInput();
	});

	// Action mode actions
	document
		.getElementById('clear-completed-btn')
		.addEventListener('click', function () {
			self.clearCompletedTasks();
		});
	document
		.getElementById('export-tasks-btn')
		.addEventListener('click', function () {
			self.exportTasks();
		});

	// Task filters
	var filterBtns = document.querySelectorAll('.filter-btn');
	for (var i = 0; i < filterBtns.length; i++) {
		filterBtns[i].addEventListener('click', function (e) {
			self.setFilter(e.target.dataset.filter);
		});
	}

	// Auto-save textarea content
	document
		.getElementById('frustration-input')
		.addEventListener('input', function () {
			self.saveToStorage(
				'currentInput',
				document.getElementById('frustration-input').value
			);
		});

	// Load saved input
	var savedInput = this.loadFromStorage('currentInput');
	if (savedInput) {
		document.getElementById('frustration-input').value = savedInput;
	}
};

FrustrationToTasksApp.prototype.switchMode = function (mode) {
	this.currentMode = mode;

	// Update mode buttons
	var modeBtns = document.querySelectorAll('.mode-btn');
	for (var i = 0; i < modeBtns.length; i++) {
		modeBtns[i].classList.remove('active');
	}
	document.getElementById(mode + '-mode-btn').classList.add('active');

	// Update mode interfaces
	var modeInterfaces = document.querySelectorAll('.mode-interface');
	for (var j = 0; j < modeInterfaces.length; j++) {
		modeInterfaces[j].classList.remove('active');
	}
	document.getElementById(mode + '-mode').classList.add('active');

	if (mode === 'action') {
		this.updateTasksDisplay();
		this.updateStats();
	}
};

FrustrationToTasksApp.prototype.processFrustration = function () {
	var self = this;
	var input = document.getElementById('frustration-input').value.trim();
	if (!input) return;

	// Show processing modal
	this.showProcessingModal();

	// Save to recent vents
	var ventEntry = {
		id: Date.now(),
		text: input,
		date: new Date().toISOString(),
		processed: false,
	};

	this.recentVents.unshift(ventEntry);
	if (this.recentVents.length > 10) {
		this.recentVents = this.recentVents.slice(0, 10);
	}

	// Simulate AI processing delay
	setTimeout(function () {
		// Process the frustration into tasks
		var newTasks = self.extractTasksFromFrustration(input);

		// Add tasks to the list
		for (var i = 0; i < newTasks.length; i++) {
			var task = newTasks[i];
			task.id = Date.now() + Math.random();
			task.createdAt = new Date().toISOString();
			task.completed = false;
			task.sourceVent = ventEntry.id;
			self.tasks.push(task);
		}

		ventEntry.processed = true;

		// Save to storage
		self.saveToStorage('tasks', self.tasks);
		self.saveToStorage('recentVents', self.recentVents);

		// Hide processing modal
		self.hideProcessingModal();

		// Clear input and switch to action mode
		document.getElementById('frustration-input').value = '';
		self.saveToStorage('currentInput', '');
		self.switchMode('action');

		// Show success feedback
		self.showNotification(
			'Generated ' + newTasks.length + ' actionable tasks!'
		);

		self.showRecentVents();
	}, 2000);
};

FrustrationToTasksApp.prototype.extractTasksFromFrustration = function (text) {
	var tasks = [];
	var sentences = text.split(/[.!?]+/).filter(function (s) {
		return s.trim().length > 10;
	});

	var frustrationPatterns = [
		{
			regex: /(?:I\s+)?(can't|cannot|unable|don't know how)\s+([^,\.!?]+)/gi,
			taskTemplate: function (match, inability, action) {
				return {
					title: 'Learn how to ' + action.trim(),
					description: 'Address the inability to ' + action.trim(),
					category: 'Learning',
					priority: 'medium',
				};
			},
		},
		{
			regex: /(?:I\s+)?(need to|should|have to|must)\s+([^,\.!?]+)/gi,
			taskTemplate: function (match, modal, action) {
				return {
					title: action.trim().charAt(0).toUpperCase() + action.trim().slice(1),
					description: modal.trim() + ' ' + action.trim(),
					category: 'Action',
					priority: modal.includes('must') ? 'high' : 'medium',
				};
			},
		},
		{
			regex:
				/(?:I'm|I am)\s+(frustrated|annoyed|tired|sick)\s+(?:of|with|by)\s+([^,\.!?]+)/gi,
			taskTemplate: function (match, emotion, source) {
				return {
					title: 'Address issues with ' + source.trim(),
					description: 'Find solutions for frustration with ' + source.trim(),
					category: 'Problem Solving',
					priority: 'high',
				};
			},
		},
		{
			regex:
				/(?:there's|there is)\s+(?:a problem|an issue|trouble)\s+(?:with|in)\s+([^,\.!?]+)/gi,
			taskTemplate: function (match, problem) {
				return {
					title: 'Fix problem with ' + problem.trim(),
					description: 'Investigate and resolve issues with ' + problem.trim(),
					category: 'Problem Solving',
					priority: 'high',
				};
			},
		},
		{
			regex: /(?:I\s+)?(want|wish|hope)\s+(?:I could|to)\s+([^,\.!?]+)/gi,
			taskTemplate: function (match, desire, goal) {
				return {
					title: 'Work towards ' + goal.trim(),
					description: 'Take steps to achieve: ' + goal.trim(),
					category: 'Goals',
					priority: 'low',
				};
			},
		},
		{
			regex:
				/(?:it's|its)\s+(too hard|difficult|complicated|confusing)\s+(?:to)?\s*([^,\.!?]*)/gi,
			taskTemplate: function (match, difficulty, task) {
				return {
					title: 'Simplify ' + (task.trim() || 'this process'),
					description: 'Break down complex task into manageable steps',
					category: 'Simplification',
					priority: 'medium',
				};
			},
		},
		{
			regex:
				/(?:I\s+)?(keep forgetting|always forget|never remember)\s+(?:to)?\s*([^,\.!?]+)/gi,
			taskTemplate: function (match, forgetfulness, task) {
				return {
					title: 'Set up reminder for ' + task.trim(),
					description: 'Create system to remember: ' + task.trim(),
					category: 'Organization',
					priority: 'medium',
				};
			},
		},
	];

	// Apply patterns to extract tasks
	for (var i = 0; i < frustrationPatterns.length; i++) {
		var pattern = frustrationPatterns[i];
		var match;
		while ((match = pattern.regex.exec(text)) !== null) {
			var task = pattern.taskTemplate.apply(null, match);
			if (task.title && task.title.length > 5) {
				tasks.push(task);
			}
		}
	}

	// If no patterns matched, create generic tasks based on key topics
	if (tasks.length === 0) {
		var keywords = this.extractKeywords(text);
		for (var j = 0; j < keywords.length; j++) {
			var keyword = keywords[j];
			tasks.push({
				title: 'Address concerns about ' + keyword,
				description: 'Take action related to: ' + keyword,
				category: 'General',
				priority: 'medium',
			});
		}
	}

	// Ensure we have at least one task
	if (tasks.length === 0) {
		tasks.push({
			title: 'Reflect on current frustrations',
			description:
				'Take time to think through the issues mentioned and plan next steps',
			category: 'Reflection',
			priority: 'low',
		});
	}

	// Remove duplicates and limit to 6 tasks max
	var uniqueTasks = [];
	for (var k = 0; k < tasks.length && k < 6; k++) {
		var task = tasks[k];
		var isDuplicate = false;
		for (var l = 0; l < uniqueTasks.length; l++) {
			if (uniqueTasks[l].title.toLowerCase() === task.title.toLowerCase()) {
				isDuplicate = true;
				break;
			}
		}
		if (!isDuplicate) {
			uniqueTasks.push(task);
		}
	}

	return uniqueTasks;
};

FrustrationToTasksApp.prototype.extractKeywords = function (text) {
	var stopWords = [
		'i',
		'me',
		'my',
		'myself',
		'we',
		'our',
		'ours',
		'ourselves',
		'you',
		'your',
		'yours',
		'yourself',
		'yourselves',
		'he',
		'him',
		'his',
		'himself',
		'she',
		'her',
		'hers',
		'herself',
		'it',
		'its',
		'itself',
		'they',
		'them',
		'their',
		'theirs',
		'themselves',
		'what',
		'which',
		'who',
		'whom',
		'this',
		'that',
		'these',
		'those',
		'am',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'being',
		'have',
		'has',
		'had',
		'having',
		'do',
		'does',
		'did',
		'doing',
		'a',
		'an',
		'the',
		'and',
		'but',
		'if',
		'or',
		'because',
		'as',
		'until',
		'while',
		'of',
		'at',
		'by',
		'for',
		'with',
		'about',
		'against',
		'between',
		'into',
		'through',
		'during',
		'before',
		'after',
		'above',
		'below',
		'up',
		'down',
		'in',
		'out',
		'on',
		'off',
		'over',
		'under',
		'again',
		'further',
		'then',
		'once',
	];

	var words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter(function (word) {
			return word.length > 3 && stopWords.indexOf(word) === -1;
		});

	var wordFreq = {};
	for (var i = 0; i < words.length; i++) {
		var word = words[i];
		wordFreq[word] = (wordFreq[word] || 0) + 1;
	}

	var sortedWords = Object.keys(wordFreq).sort(function (a, b) {
		return wordFreq[b] - wordFreq[a];
	});

	return sortedWords.slice(0, 3);
};

FrustrationToTasksApp.prototype.showProcessingModal = function () {
	var modal = document.getElementById('processing-modal');
	modal.classList.add('active');

	var steps = [
		'Identifying key issues',
		'Analyzing frustration patterns',
		'Generating actionable tasks',
		'Prioritizing recommendations',
	];

	var stepIndex = 0;
	var stepElement = document.querySelector('.processing-step');

	var interval = setInterval(function () {
		if (stepIndex < steps.length) {
			stepElement.textContent = steps[stepIndex];
			stepIndex++;
		} else {
			clearInterval(interval);
		}
	}, 500);
};

FrustrationToTasksApp.prototype.hideProcessingModal = function () {
	document.getElementById('processing-modal').classList.remove('active');
};

FrustrationToTasksApp.prototype.clearInput = function () {
	document.getElementById('frustration-input').value = '';
	this.saveToStorage('currentInput', '');
};

FrustrationToTasksApp.prototype.updateTasksDisplay = function () {
	var tasksList = document.getElementById('tasks-list');
	var placeholder = document.getElementById('no-tasks-placeholder');

	var filteredTasks = this.tasks;

	if (this.currentFilter === 'completed') {
		filteredTasks = this.tasks.filter(function (task) {
			return task.completed;
		});
	} else if (this.currentFilter === 'pending') {
		filteredTasks = this.tasks.filter(function (task) {
			return !task.completed;
		});
	}

	if (filteredTasks.length === 0) {
		tasksList.innerHTML = '';
		placeholder.style.display = 'block';
		return;
	}

	placeholder.style.display = 'none';

	var html = '';
	for (var i = 0; i < filteredTasks.length; i++) {
		var task = filteredTasks[i];
		html +=
			'<div class="task-item ' +
			(task.completed ? 'completed' : '') +
			'" data-task-id="' +
			task.id +
			'">' +
			'<div class="task-header">' +
			'<div class="task-checkbox ' +
			(task.completed ? 'checked' : '') +
			'" onclick="app.toggleTask(' +
			task.id +
			')"></div>' +
			'<div class="task-title">' +
			task.title +
			'</div>' +
			'</div>' +
			'<div class="task-description">' +
			task.description +
			'</div>' +
			'<div class="task-metadata">' +
			'<span class="task-category">' +
			task.category +
			'</span>' +
			'<span class="task-priority ' +
			task.priority +
			'">' +
			task.priority.toUpperCase() +
			'</span>' +
			'</div>' +
			'</div>';
	}
	tasksList.innerHTML = html;
};

FrustrationToTasksApp.prototype.toggleTask = function (taskId) {
	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			this.tasks[i].completed = !this.tasks[i].completed;
			this.tasks[i].completedAt = this.tasks[i].completed
				? new Date().toISOString()
				: null;
			break;
		}
	}
	this.saveToStorage('tasks', this.tasks);
	this.updateTasksDisplay();
	this.updateStats();
};

FrustrationToTasksApp.prototype.updateStats = function () {
	var total = this.tasks.length;
	var completed = this.tasks.filter(function (t) {
		return t.completed;
	}).length;
	var rate = total > 0 ? Math.round((completed / total) * 100) : 0;

	document.getElementById('total-tasks').textContent = total;
	document.getElementById('completed-tasks').textContent = completed;
	document.getElementById('completion-rate').textContent = rate + '%';
};

FrustrationToTasksApp.prototype.setFilter = function (filter) {
	this.currentFilter = filter;

	var filterBtns = document.querySelectorAll('.filter-btn');
	for (var i = 0; i < filterBtns.length; i++) {
		filterBtns[i].classList.remove('active');
	}
	document
		.querySelector('[data-filter="' + filter + '"]')
		.classList.add('active');

	this.updateTasksDisplay();
};

FrustrationToTasksApp.prototype.clearCompletedTasks = function () {
	this.tasks = this.tasks.filter(function (task) {
		return !task.completed;
	});
	this.saveToStorage('tasks', this.tasks);
	this.updateTasksDisplay();
	this.updateStats();
	this.showNotification('Completed tasks cleared!');
};

FrustrationToTasksApp.prototype.exportTasks = function () {
	var data = {
		tasks: this.tasks,
		recentVents: this.recentVents,
		exportDate: new Date().toISOString(),
	};

	var blob = new Blob([JSON.stringify(data, null, 2)], {
		type: 'application/json',
	});
	var url = URL.createObjectURL(blob);
	var a = document.createElement('a');
	a.href = url;
	a.download =
		'frustration-tasks-' + new Date().toISOString().split('T')[0] + '.json';
	a.click();
	URL.revokeObjectURL(url);

	this.showNotification('Tasks exported successfully!');
};

FrustrationToTasksApp.prototype.showRecentVents = function () {
	var recentVentsList = document.getElementById('recent-vents-list');

	if (this.recentVents.length === 0) {
		recentVentsList.innerHTML =
			'<p style="color: #adb5bd; text-align: center; padding: 20px;">No recent vents yet</p>';
		return;
	}

	var html = '';
	var ventsToShow = this.recentVents.slice(0, 5);
	for (var i = 0; i < ventsToShow.length; i++) {
		var vent = ventsToShow[i];
		html +=
			'<div class="recent-entry" onclick="app.loadVentToInput(\'' +
			vent.id +
			'\')">' +
			'<div class="recent-entry-text">' +
			vent.text +
			'</div>' +
			'<div class="recent-entry-date">' +
			new Date(vent.date).toLocaleDateString() +
			'</div>' +
			'</div>';
	}
	recentVentsList.innerHTML = html;
};

FrustrationToTasksApp.prototype.loadVentToInput = function (ventId) {
	for (var i = 0; i < this.recentVents.length; i++) {
		if (this.recentVents[i].id == ventId) {
			document.getElementById('frustration-input').value =
				this.recentVents[i].text;
			break;
		}
	}
};

FrustrationToTasksApp.prototype.showNotification = function (message) {
	var toast = document.createElement('div');
	toast.style.cssText =
		'position: fixed; top: 20px; right: 20px; background: #007bff; color: white; padding: 12px 20px; border-radius: 8px; font-weight: 500; z-index: 10000; animation: slideInRight 0.3s ease-out;';
	toast.textContent = message;
	document.body.appendChild(toast);

	setTimeout(function () {
		toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
		setTimeout(function () {
			if (toast.parentNode) {
				document.body.removeChild(toast);
			}
		}, 300);
	}, 3000);
};

FrustrationToTasksApp.prototype.updateUI = function () {
	this.updateTasksDisplay();
	this.updateStats();
};

FrustrationToTasksApp.prototype.saveToStorage = function (key, data) {
	localStorage.setItem('frustrationTasks_' + key, JSON.stringify(data));
};

FrustrationToTasksApp.prototype.loadFromStorage = function (key) {
	var data = localStorage.getItem('frustrationTasks_' + key);
	return data ? JSON.parse(data) : null;
};

// Initialize the app
var app = new FrustrationToTasksApp();

// Add CSS for toast animations
var style = document.createElement('style');
style.textContent =
	'@keyframes slideInRight { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } } @keyframes slideOutRight { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }';
document.head.appendChild(style);
