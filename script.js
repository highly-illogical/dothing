// Browser-compatible version using function constructors instead of ES6 classes
function FrustrationToTasksApp() {
	this.currentMode = 'vent';
	this.tasks = this.loadFromStorage('tasks') || [];
	this.recentVents = this.loadFromStorage('recentVents') || [];
	this.currentFilter = 'all';
	this.apiKey = this.loadFromStorage('apiKey') || '';
	this.llmProvider = this.loadFromStorage('llmProvider') || 'openai';
	this.customPrompt = this.loadFromStorage('customPrompt') || '';

	this.init();
}

FrustrationToTasksApp.prototype.init = function () {
	this.bindEvents();
	this.updateUI();
	this.showRecentVents();
	this.checkRecurringTasks();

	// Check for overdue recurring tasks every 5 minutes
	var self = this;
	setInterval(function () {
		self.checkRecurringTasks();
	}, 5 * 60 * 1000);
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
		.getElementById('task-mode-btn')
		.addEventListener('click', function () {
			self.switchMode('task');
		});
	document
		.getElementById('progress-mode-btn')
		.addEventListener('click', function () {
			self.switchMode('progress');
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

	// Settings modal
	document
		.getElementById('settings-btn')
		.addEventListener('click', function () {
			self.showSettingsModal();
		});
	document
		.getElementById('save-settings-btn')
		.addEventListener('click', function () {
			self.saveSettings();
		});
	document
		.getElementById('close-settings-btn')
		.addEventListener('click', function () {
			self.hideSettingsModal();
		});
	document
		.getElementById('reset-prompt-btn')
		.addEventListener('click', function () {
			self.resetPrompt();
		});
	document
		.getElementById('load-example-btn')
		.addEventListener('click', function () {
			self.loadExamplePrompt();
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

	if (mode === 'task') {
		this.updateTasksDisplay();
	} else if (mode === 'progress') {
		this.updateStats();
		this.updatePriorityBreakdown();
		this.updateRecentCompletions();
	}
};

FrustrationToTasksApp.prototype.processFrustration = function () {
	var self = this;
	var input = document.getElementById('frustration-input').value.trim();

	// Check if API key is configured
	if (!this.apiKey) {
		this.showNotification('Please configure your API key in settings first!');
		this.showSettingsModal();
		return;
	}

	// Show processing modal
	this.showProcessingModal();

	// Save current input to recent vents if it exists
	if (input) {
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
	}

	// Collect all vents text
	var allVentsText = [];
	if (input) {
		allVentsText.push(input);
	}

	// Add recent vents (up to 5 most recent)
	var recentVentsToProcess = this.recentVents.slice(0, 5);
	for (var i = 0; i < recentVentsToProcess.length; i++) {
		var vent = recentVentsToProcess[i];
		// Avoid duplicating the current input
		if (vent.text !== input) {
			allVentsText.push(vent.text);
		}
	}

	if (allVentsText.length === 0) {
		this.hideProcessingModal();
		this.showNotification('Please enter some frustrations to process');
		return;
	}

	// Process all frustrations together using LLM
	this.extractTasksFromAllFrustrations(allVentsText)
		.then(function (newTasks) {
			// Replace entire task list with new comprehensive list
			self.tasks = [];
			for (var i = 0; i < newTasks.length; i++) {
				var task = newTasks[i];
				task.id = Date.now() + Math.random() + i;
				task.createdAt = new Date().toISOString();
				task.completed = false;
				self.tasks.push(task);
			}

			// Mark all processed vents as processed
			for (var j = 0; j < self.recentVents.length; j++) {
				self.recentVents[j].processed = true;
			}

			// Save to storage
			self.saveToStorage('tasks', self.tasks);
			self.saveToStorage('recentVents', self.recentVents);

			// Hide processing modal
			self.hideProcessingModal();

			// Clear input and switch to task mode
			document.getElementById('frustration-input').value = '';
			self.saveToStorage('currentInput', '');
			self.switchMode('task');

			// Show success feedback
			self.showNotification(
				'Generated ' +
					newTasks.length +
					' actionable tasks from ' +
					allVentsText.length +
					' frustrations!'
			);

			self.showRecentVents();
		})
		.catch(function (error) {
			console.error('Error processing frustrations:', error);
			self.hideProcessingModal();
			self.showNotification('Error processing frustrations: ' + error.message);
		});
};

FrustrationToTasksApp.prototype.extractTasksFromAllFrustrations = function (
	allVentsText
) {
	var self = this;

	var defaultPrompt = `You are a helpful assistant that converts people's frustrations and complaints into actionable tasks. 

Please analyze the following collection of frustrations/vents and convert them into a comprehensive set of specific, actionable tasks that could help address the underlying issues across ALL the frustrations.

Look for patterns, common themes, and root causes across all the frustrations. Create tasks that address the root causes, but focus more on things that are immediately doable, not things that require too much planning or organization.

For each task, provide:
- title: A clear, concise title (don't use initcaps for every word)
- description: A longer, detailed description that explains what needs to be done, why it's important, and any helpful context, tips, or suggestions. This will be shown in a collapsible panel when the user wants more details.
- category: One of these categories: Learning, Action, Problem Solving, Goals, Simplification, Organization, Communication, Planning, Research, or General
- priority: low, medium, or high
- recurring: Set to "none" for one-time tasks, or "daily", "weekly", or "monthly" for recurring tasks. Use recurring tasks for habits, maintenance, or regular check-ins that would help prevent similar frustrations.

Frustrations:
{text}`;

	var prompt = this.customPrompt || defaultPrompt;
	var combinedText = '';
	for (var i = 0; i < allVentsText.length; i++) {
		combinedText += i + 1 + '. ' + allVentsText[i] + '\n\n';
	}
	prompt = prompt.replace('{text}', combinedText);

	return this.callLLMAPI(prompt).then(function (tasks) {
		try {
			// Validate and clean the tasks (tasks is already an array)
			var validTasks = [];
			for (var i = 0; i < tasks.length; i++) {
				var task = tasks[i];
				if (
					task.title &&
					task.description &&
					task.category &&
					task.priority &&
					task.recurring
				) {
					var recurringValue = ['none', 'daily', 'weekly', 'monthly'].includes(
						task.recurring.toLowerCase()
					)
						? task.recurring.toLowerCase()
						: 'none';

					validTasks.push({
						title: task.title.substring(0, 100),
						description: task.description.substring(0, 800),
						category: task.category,
						priority: ['low', 'medium', 'high'].includes(
							task.priority.toLowerCase()
						)
							? task.priority.toLowerCase()
							: 'medium',
						recurring: recurringValue,
						nextDue:
							recurringValue !== 'none' ? new Date().toISOString() : null,
					});
				}
			}

			// Ensure we have at least one task
			if (validTasks.length === 0) {
				validTasks.push({
					title: 'Reflect on current situation',
					description:
						"Take time to think through the issues mentioned and plan next steps. Consider what's working, what isn't, and what small changes you could make to improve your situation.",
					category: 'Planning',
					priority: 'medium',
					recurring: 'none',
					nextDue: null,
				});
			}

			return validTasks;
		} catch (error) {
			console.error('Error processing LLM response:', error);
			// Fallback to a default task
			return [
				{
					title: 'Address current concerns',
					description:
						'Work on the issues mentioned in your recent thoughts. Start with the most pressing issue and take one small action to move forward.',
					category: 'General',
					priority: 'medium',
					recurring: 'none',
					nextDue: null,
				},
			];
		}
	});
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

FrustrationToTasksApp.prototype.callLLMAPI = function (prompt) {
	var self = this;

	if (this.llmProvider === 'openai') {
		var requestBody = {
			model: 'gpt-4o',
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 1000,
			temperature: 0.7,
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'task_list',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							tasks: {
								type: 'array',
								minItems: 1,
								items: {
									type: 'object',
									properties: {
										title: {
											type: 'string',
											maxLength: 100,
										},
										description: {
											type: 'string',
											maxLength: 800,
										},
										category: {
											type: 'string',
											enum: [
												'Learning',
												'Action',
												'Problem Solving',
												'Goals',
												'Simplification',
												'Organization',
												'Communication',
												'Planning',
												'Research',
												'General',
											],
										},
										priority: {
											type: 'string',
											enum: ['low', 'medium', 'high'],
										},
										recurring: {
											type: 'string',
											enum: ['none', 'daily', 'weekly', 'monthly'],
										},
									},
									required: [
										'title',
										'description',
										'category',
										'priority',
										'recurring',
									],
									additionalProperties: false,
								},
							},
						},
						required: ['tasks'],
						additionalProperties: false,
					},
				},
			},
		};

		return fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + this.apiKey,
			},
			body: JSON.stringify(requestBody),
		})
			.then(function (response) {
				if (!response.ok) {
					throw new Error('API request failed: ' + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				if (data.choices && data.choices[0] && data.choices[0].message) {
					var content = data.choices[0].message.content.trim();
					var parsedContent = JSON.parse(content);
					return parsedContent.tasks; // Return the tasks array directly
				} else {
					throw new Error('Invalid API response format');
				}
			});
	} else if (this.llmProvider === 'anthropic') {
		// Anthropic doesn't have structured output yet, so we use a more detailed prompt
		var enhancedPrompt =
			prompt +
			'\n\nPlease respond with a valid JSON object containing a "tasks" array. Each task should have exactly these fields: title, description, category, priority. Example format:\n{"tasks": [{"title": "Example task", "description": "Task description", "category": "Action", "priority": "medium"}]}';

		return fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: 'claude-3-haiku-20240307',
				max_tokens: 1000,
				messages: [
					{
						role: 'user',
						content: enhancedPrompt,
					},
				],
			}),
		})
			.then(function (response) {
				if (!response.ok) {
					throw new Error('API request failed: ' + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				if (data.content && data.content[0] && data.content[0].text) {
					var content = data.content[0].text.trim();
					var parsedContent = JSON.parse(content);
					return parsedContent.tasks; // Return the tasks array directly
				} else {
					throw new Error('Invalid API response format');
				}
			});
	} else {
		return Promise.reject(new Error('Unsupported LLM provider'));
	}
};

FrustrationToTasksApp.prototype.showProcessingModal = function () {
	var modal = document.getElementById('processing-modal');
	modal.classList.add('active');

	var steps = [
		'Collecting all frustrations',
		'Identifying patterns and themes',
		'Analyzing root causes',
		'Generating comprehensive task list',
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
	} else if (this.currentFilter === 'high') {
		filteredTasks = this.tasks.filter(function (task) {
			return task.priority === 'high';
		});
	} else if (this.currentFilter === 'medium') {
		filteredTasks = this.tasks.filter(function (task) {
			return task.priority === 'medium';
		});
	} else if (this.currentFilter === 'low') {
		filteredTasks = this.tasks.filter(function (task) {
			return task.priority === 'low';
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
		var recurringClass =
			task.recurring && task.recurring !== 'none' ? ' recurring' : '';
		var recurringIcon =
			task.recurring && task.recurring !== 'none'
				? '<span class="recurring-icon" title="Recurring ' +
				  task.recurring +
				  '">↻</span>'
				: '';
		var detailsButton =
			task.description && task.description.trim()
				? '<button class="details-toggle-btn" onclick="app.toggleDetails(' +
				  task.id +
				  ')" title="Show/Hide Details">ℹ️</button>'
				: '';

		html +=
			'<div class="task-item ' +
			(task.completed ? 'completed' : '') +
			recurringClass +
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
			recurringIcon +
			'</div>' +
			detailsButton +
			'</div>';

		// Add details section with description
		if (task.description && task.description.trim()) {
			html +=
				'<div class="task-details" id="details-' +
				task.id +
				'" style="display: none;">' +
				'<div class="details-content">' +
				task.description.replace(/\n/g, '<br>') +
				'</div>' +
				'</div>';
		}

		html +=
			'<div class="task-metadata">' +
			'<span class="task-category">' +
			task.category +
			'</span>' +
			'<span class="task-priority ' +
			task.priority +
			'">' +
			task.priority.toUpperCase() +
			'</span>' +
			(task.recurring && task.recurring !== 'none'
				? '<span class="task-recurring">' +
				  task.recurring.toUpperCase() +
				  '</span>'
				: '') +
			'</div>' +
			'</div>';
	}
	tasksList.innerHTML = html;
};

FrustrationToTasksApp.prototype.toggleTask = function (taskId) {
	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			var task = this.tasks[i];
			task.completed = !task.completed;

			if (task.completed) {
				task.completedAt = new Date().toISOString();

				// Handle recurring tasks
				if (task.recurring && task.recurring !== 'none') {
					var self = this;
					// Reset the task after a short delay to show completion feedback
					setTimeout(function () {
						self.resetRecurringTask(taskId);
					}, 2000);
				}
			} else {
				task.completedAt = null;
			}
			break;
		}
	}
	this.saveToStorage('tasks', this.tasks);
	this.updateTasksDisplay();
	this.updateStats();
	this.updatePriorityBreakdown();
	this.updateRecentCompletions();
};

FrustrationToTasksApp.prototype.toggleDetails = function (taskId) {
	var detailsElement = document.getElementById('details-' + taskId);
	if (detailsElement) {
		if (detailsElement.style.display === 'none') {
			detailsElement.style.display = 'block';
		} else {
			detailsElement.style.display = 'none';
		}
	}
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

FrustrationToTasksApp.prototype.updatePriorityBreakdown = function () {
	var highCount = this.tasks.filter(function (t) {
		return t.priority === 'high';
	}).length;
	var mediumCount = this.tasks.filter(function (t) {
		return t.priority === 'medium';
	}).length;
	var lowCount = this.tasks.filter(function (t) {
		return t.priority === 'low';
	}).length;

	document.getElementById('high-priority-count').textContent = highCount;
	document.getElementById('medium-priority-count').textContent = mediumCount;
	document.getElementById('low-priority-count').textContent = lowCount;
};

FrustrationToTasksApp.prototype.updateRecentCompletions = function () {
	var recentCompletions = this.tasks
		.filter(function (t) {
			return t.completed && t.completedAt;
		})
		.sort(function (a, b) {
			return new Date(b.completedAt) - new Date(a.completedAt);
		})
		.slice(0, 5);

	var recentList = document.getElementById('recent-completions-list');

	if (recentCompletions.length === 0) {
		recentList.innerHTML = '<p class="no-recent">No recent completions</p>';
		return;
	}

	var html = '';
	for (var i = 0; i < recentCompletions.length; i++) {
		var task = recentCompletions[i];
		var timeAgo = this.getTimeAgo(new Date(task.completedAt));
		html +=
			'<div class="recent-completion-item">' +
			'<span class="recent-completion-title">' +
			task.title +
			'</span>' +
			'<span class="recent-completion-time">' +
			timeAgo +
			'</span>' +
			'</div>';
	}
	recentList.innerHTML = html;
};

FrustrationToTasksApp.prototype.getTimeAgo = function (date) {
	var now = new Date();
	var diffMs = now - date;
	var diffMinutes = Math.floor(diffMs / (1000 * 60));
	var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 60) {
		return diffMinutes <= 1 ? 'Just now' : diffMinutes + ' min ago';
	} else if (diffHours < 24) {
		return diffHours === 1 ? '1 hour ago' : diffHours + ' hours ago';
	} else {
		return diffDays === 1 ? '1 day ago' : diffDays + ' days ago';
	}
};

FrustrationToTasksApp.prototype.resetRecurringTask = function (taskId) {
	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			var task = this.tasks[i];
			if (task.recurring && task.recurring !== 'none') {
				task.completed = false;
				task.completedAt = null;
				task.nextDue = this.calculateNextDueDate(task.recurring);

				this.saveToStorage('tasks', this.tasks);
				this.updateTasksDisplay();
				this.updateStats();
				this.updatePriorityBreakdown();
				this.updateRecentCompletions();

				this.showNotification(
					'Recurring task "' + task.title + '" has been reset'
				);
			}
			break;
		}
	}
};

FrustrationToTasksApp.prototype.calculateNextDueDate = function (recurring) {
	var now = new Date();
	var nextDue = new Date(now);

	switch (recurring) {
		case 'daily':
			nextDue.setDate(now.getDate() + 1);
			break;
		case 'weekly':
			nextDue.setDate(now.getDate() + 7);
			break;
		case 'monthly':
			nextDue.setMonth(now.getMonth() + 1);
			break;
		default:
			return null;
	}

	return nextDue.toISOString();
};

FrustrationToTasksApp.prototype.checkRecurringTasks = function () {
	var now = new Date();
	var hasChanges = false;

	for (var i = 0; i < this.tasks.length; i++) {
		var task = this.tasks[i];

		// Check if this is a completed recurring task that's past its next due date
		if (
			task.recurring &&
			task.recurring !== 'none' &&
			task.completed &&
			task.nextDue
		) {
			var nextDue = new Date(task.nextDue);

			if (now >= nextDue) {
				task.completed = false;
				task.completedAt = null;
				task.nextDue = this.calculateNextDueDate(task.recurring);
				hasChanges = true;
			}
		}
	}

	if (hasChanges) {
		this.saveToStorage('tasks', this.tasks);
		this.updateTasksDisplay();
		this.updateStats();
		this.updatePriorityBreakdown();
		this.updateRecentCompletions();
	}
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
	this.updatePriorityBreakdown();
	this.updateRecentCompletions();
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

FrustrationToTasksApp.prototype.showSettingsModal = function () {
	var modal = document.getElementById('settings-modal');
	modal.classList.add('active');

	// Load current settings
	document.getElementById('api-key-input').value = this.apiKey;
	document.getElementById('llm-provider-select').value = this.llmProvider;
	document.getElementById('custom-prompt-input').value = this.customPrompt;
};

FrustrationToTasksApp.prototype.hideSettingsModal = function () {
	document.getElementById('settings-modal').classList.remove('active');
};

FrustrationToTasksApp.prototype.resetPrompt = function () {
	document.getElementById('custom-prompt-input').value = '';
	this.showNotification('Prompt reset to default');
};

FrustrationToTasksApp.prototype.loadExamplePrompt = function () {
	var examplePrompt = `You are a productivity coach helping someone turn their collection of frustrations into a strategic action plan.

Analyze these frustrations: "{text}"

Look for patterns and root causes across all frustrations. Create 5-8 practical tasks that address the core issues holistically. Focus on:
- Small, manageable steps (can be done in 30 minutes or less)
- Clear actions with specific outcomes
- Building momentum and confidence
- Addressing systemic issues, not just symptoms

For each task, provide:
- title: Action-oriented title (under 50 characters)
- description: Longer detailed explanation including what to do, why it helps, any tips, context, or step-by-step guidance if needed
- category: Choose from Action, Planning, Communication, Learning, Organization
- priority: high (urgent/blocks other work), medium (important), or low (nice to have)
- recurring: Set to "none" for one-time tasks, or "daily", "weekly", or "monthly" for habits and maintenance tasks

Make the tasks feel achievable and motivating, creating a cohesive plan that tackles the bigger picture.`;

	document.getElementById('custom-prompt-input').value = examplePrompt;
	this.showNotification('Example prompt loaded');
};

FrustrationToTasksApp.prototype.saveSettings = function () {
	var apiKey = document.getElementById('api-key-input').value.trim();
	var provider = document.getElementById('llm-provider-select').value;
	var customPrompt = document
		.getElementById('custom-prompt-input')
		.value.trim();

	if (!apiKey) {
		this.showNotification('Please enter an API key');
		return;
	}

	this.apiKey = apiKey;
	this.llmProvider = provider;
	this.customPrompt = customPrompt;

	// Save to storage
	this.saveToStorage('apiKey', this.apiKey);
	this.saveToStorage('llmProvider', this.llmProvider);
	this.saveToStorage('customPrompt', this.customPrompt);

	this.hideSettingsModal();
	this.showNotification('Settings saved successfully!');
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
