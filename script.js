// Browser-compatible version using function constructors instead of ES6 classes
function FrustrationToTasksApp() {
	this.currentMode = 'vent';
	this.tasks = []; // Will be populated from Supabase
	this.allVents = []; // Will be populated from Supabase
	this.apiKey = this.loadFromStorage('apiKey') || '';
	this.llmProvider = this.loadFromStorage('llmProvider') || 'openai';
	this.customPrompt = this.loadFromStorage('customPrompt') || '';

	this.supabase = window.supabase.createClient(
		window.CONFIG.supabaseUrl,
		window.CONFIG.supabaseKey
	);

	this.init();
}

FrustrationToTasksApp.prototype.init = async function () {
	// Load both vents and tasks from Supabase
	await Promise.all([
		this.loadVentsFromSupabase(),
		this.loadTasksFromSupabase(),
	]);

	this.bindEvents();
	this.updateUI();
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
		.getElementById('vents-mode-btn')
		.addEventListener('click', function () {
			self.switchMode('vents');
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

	// Vents mode actions
	document
		.getElementById('clear-all-vents-btn')
		.addEventListener('click', function () {
			self.clearAllVents();
		});
	document
		.getElementById('export-vents-btn')
		.addEventListener('click', function () {
			self.exportVents();
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

	// Task notes modal
	document
		.getElementById('save-task-notes-btn')
		.addEventListener('click', function () {
			self.saveTaskNotes();
		});
	document
		.getElementById('close-task-notes-btn')
		.addEventListener('click', function () {
			self.hideTaskNotesModal();
		});
	document
		.getElementById('cancel-task-notes-btn')
		.addEventListener('click', function () {
			self.hideTaskNotesModal();
		});

	// Task filters
	document
		.getElementById('status-filter')
		.addEventListener('change', function () {
			self.applyFilters();
		});
	document
		.getElementById('priority-filter')
		.addEventListener('change', function () {
			self.applyFilters();
		});
	document
		.getElementById('recurrence-filter')
		.addEventListener('change', function () {
			self.applyFilters();
		});

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

	// Add new event listener for generating tasks from vents
	document
		.getElementById('generate-tasks-btn')
		.addEventListener('click', function () {
			self.generateTasksFromVents();
		});
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
	} else if (mode === 'vents') {
		this.updateAllVentsDisplay();
	}
};

FrustrationToTasksApp.prototype.processFrustration = async function () {
	var input = document.getElementById('frustration-input').value.trim();

	if (!input) {
		this.showNotification('Please enter some text first');
		return;
	}

	try {
		var ventEntry = {
			text: input,
			date: new Date().toISOString(),
			processed: false,
		};

		// Insert into Supabase
		const { data, error } = await this.supabase
			.from('vents')
			.insert([ventEntry])
			.select();

		if (error) {
			console.error('Error saving vent to Supabase:', error);
			this.showNotification('Error saving vent!');
			return;
		}

		// Use the ID from Supabase
		ventEntry = data[0];
		this.allVents.unshift(ventEntry);
		this.saveToStorage('allVents', this.allVents);

		// Clear input and show success message
		document.getElementById('frustration-input').value = '';
		this.saveToStorage('currentInput', '');
		this.showNotification('Vent saved successfully!');
	} catch (error) {
		console.error('Error in processFrustration:', error);
		this.showNotification('Error saving vent!');
	}
};

FrustrationToTasksApp.prototype.extractTasksFromAllFrustrations = function (
	allVentsText
) {
	var self = this;

	var prompt = this.customPrompt || this.getDefaultPrompt();
	var combinedText = '';
	for (var i = 0; i < allVentsText.length; i++) {
		combinedText += i + 1 + '. ' + allVentsText[i] + '\n\n';
	}

	// Add existing task notes if they exist
	var existingTasksWithNotes = this.tasks.filter(function (task) {
		return task.notes && task.notes.trim();
	});

	if (existingTasksWithNotes.length > 0) {
		combinedText += '\n\nExisting task notes to consider:\n';
		for (var j = 0; j < existingTasksWithNotes.length; j++) {
			var task = existingTasksWithNotes[j];
			combinedText += '- ' + task.title + ': ' + task.notes + '\n';
		}
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

					// Process subtasks if they exist
					var processedSubtasks = [];
					if (task.subtasks && Array.isArray(task.subtasks)) {
						for (var s = 0; s < task.subtasks.length; s++) {
							var subtaskText =
								typeof task.subtasks[s] === 'string'
									? task.subtasks[s]
									: task.subtasks[s].text || '';

							if (subtaskText.trim()) {
								processedSubtasks.push({
									text: subtaskText.trim().substring(0, 200),
									completed: false,
									id: Date.now() + Math.random() + s,
								});
							}
						}
					}

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
						subtasks: processedSubtasks,
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
					subtasks: [],
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
					subtasks: [],
				},
			];
		}
	});
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
										subtasks: {
											type: 'array',
											items: {
												type: 'string',
												maxLength: 200,
											},
											maxItems: 10,
										},
									},
									required: [
										'title',
										'description',
										'category',
										'priority',
										'recurring',
										'subtasks',
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
					// Get the error details from the response
					return response
						.json()
						.then(function (errorData) {
							console.error('OpenAI API Error:', {
								status: response.status,
								statusText: response.statusText,
								error: errorData,
							});
							throw new Error(
								'API request failed: ' +
									response.status +
									' - ' +
									(errorData.error?.message ||
										errorData.message ||
										'Unknown error')
							);
						})
						.catch(function (parseError) {
							// If we can't parse the error response as JSON
							console.error('OpenAI API Error:', {
								status: response.status,
								statusText: response.statusText,
								parseError: parseError,
							});
							throw new Error(
								'API request failed: ' +
									response.status +
									' - ' +
									response.statusText
							);
						});
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
					// Get the error details from the response
					return response
						.json()
						.then(function (errorData) {
							console.error('Anthropic API Error:', {
								status: response.status,
								statusText: response.statusText,
								error: errorData,
							});
							throw new Error(
								'API request failed: ' +
									response.status +
									' - ' +
									(errorData.error?.message ||
										errorData.message ||
										'Unknown error')
							);
						})
						.catch(function (parseError) {
							// If we can't parse the error response as JSON
							console.error('Anthropic API Error:', {
								status: response.status,
								statusText: response.statusText,
								parseError: parseError,
							});
							throw new Error(
								'API request failed: ' +
									response.status +
									' - ' +
									response.statusText
							);
						});
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

	// Get filter values
	var statusFilter = document.getElementById('status-filter').value;
	var priorityFilter = document.getElementById('priority-filter').value;
	var recurrenceFilter = document.getElementById('recurrence-filter').value;

	// Apply status filter
	if (statusFilter === 'completed') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.completed;
		});
	} else if (statusFilter === 'pending') {
		filteredTasks = filteredTasks.filter(function (task) {
			return !task.completed;
		});
	}

	// Apply priority filter
	if (priorityFilter === 'high') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.priority === 'high';
		});
	} else if (priorityFilter === 'medium') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.priority === 'medium';
		});
	} else if (priorityFilter === 'low') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.priority === 'low';
		});
	}

	// Apply recurrence filter
	if (recurrenceFilter === 'daily') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.recurring === 'daily';
		});
	} else if (recurrenceFilter === 'weekly') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.recurring === 'weekly';
		});
	} else if (recurrenceFilter === 'monthly') {
		filteredTasks = filteredTasks.filter(function (task) {
			return task.recurring === 'monthly';
		});
	} else if (recurrenceFilter === 'non-recurring') {
		filteredTasks = filteredTasks.filter(function (task) {
			return !task.recurring || task.recurring === 'none';
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
		var priorityClass = ' priority-' + task.priority;
		var recurringIcon =
			task.recurring && task.recurring !== 'none'
				? '<span class="recurring-icon" title="Recurring ' +
				  task.recurring +
				  '">↻</span>'
				: '';

		html +=
			'<div class="task-item ' +
			(task.completed ? 'completed' : '') +
			recurringClass +
			priorityClass +
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
			'<span class="task-title-text">' +
			task.title +
			'</span>' +
			recurringIcon +
			'</div>' +
			'<div class="task-metadata">' +
			'<span class="task-category">' +
			task.category +
			'</span>' +
			(task.recurring && task.recurring !== 'none'
				? '<span class="task-recurring">' +
				  task.recurring.toUpperCase() +
				  '</span>'
				: '') +
			'</div>' +
			'</div>';

		// Add description if it exists
		if (task.description && task.description.trim()) {
			html +=
				'<div class="task-description expandable">' +
				task.description.replace(/\n/g, '<br>') +
				'</div>';
		}

		// Add subtasks section
		if (task.subtasks && task.subtasks.length > 0) {
			html += '<div class="task-subtasks-section">';
			html += '<div class="subtasks-header">Subtasks:</div>';
			html += '<div class="subtasks-list">';
			for (var s = 0; s < task.subtasks.length; s++) {
				var subtask = task.subtasks[s];
				html +=
					'<div class="subtask-item">' +
					'<div class="subtask-checkbox ' +
					(subtask.completed ? 'checked' : '') +
					'" onclick="app.toggleSubtask(' +
					task.id +
					', ' +
					s +
					')"></div>' +
					'<span class="subtask-text ' +
					(subtask.completed ? 'completed' : '') +
					'">' +
					subtask.text +
					'</span>' +
					'<button class="subtask-delete-btn" onclick="app.deleteSubtask(' +
					task.id +
					', ' +
					s +
					')">×</button>' +
					'</div>';
			}
			html += '</div>';
			html += '</div>';
		}

		// Add notes section
		html += '<div class="task-notes-section">';
		if (task.notes && task.notes.trim()) {
			html +=
				'<div class="task-notes">' +
				'<strong>Notes:</strong> ' +
				task.notes.replace(/\n/g, '<br>') +
				'</div>';
		}
		html +=
			'<div class="task-actions">' +
			'<button class="task-action-btn" onclick="app.editTaskNotes(' +
			task.id +
			')">' +
			(task.notes && task.notes.trim() ? 'Edit Notes' : 'Add Notes') +
			'</button>' +
			'<button class="task-action-btn" onclick="app.addSubtask(' +
			task.id +
			')">Add Subtask</button>' +
			'</div>' +
			'</div>';

		html += '</div>';
	}
	tasksList.innerHTML = html;
};

FrustrationToTasksApp.prototype.toggleTask = async function (taskId) {
	const task = this.tasks.find((t) => t.id === taskId);
	if (!task) return;

	const newCompletedState = !task.completed;
	const updates = {
		completed: newCompletedState,
		completed_at: newCompletedState ? new Date().toISOString() : null,
	};

	try {
		const { error } = await this.supabase
			.from('tasks')
			.update(updates)
			.eq('id', taskId);

		if (error) throw error;

		// Update local state
		task.completed = newCompletedState;
		task.completedAt = updates.completed_at;

		// Handle recurring tasks
		if (task.completed && task.recurring && task.recurring !== 'none') {
			setTimeout(() => this.resetRecurringTask(taskId), 2000);
		}

		this.updateTasksDisplay();
		this.updateStats();
		this.updatePriorityBreakdown();
		this.updateRecentCompletions();
	} catch (error) {
		console.error('Error toggling task:', error);
		this.showNotification('Error updating task status!');
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

FrustrationToTasksApp.prototype.resetRecurringTask = async function (taskId) {
	const task = this.tasks.find((t) => t.id === taskId);
	if (!task || !task.recurring || task.recurring === 'none') return;

	const nextDue = this.calculateNextDueDate(task.recurring);

	try {
		const { error } = await this.supabase
			.from('tasks')
			.update({
				completed: false,
				completed_at: null,
				next_due: nextDue,
			})
			.eq('id', taskId);

		if (error) throw error;

		// Update local state
		task.completed = false;
		task.completedAt = null;
		task.nextDue = nextDue;

		this.updateTasksDisplay();
		this.updateStats();
		this.updatePriorityBreakdown();
		this.updateRecentCompletions();
		this.showNotification('Recurring task "' + task.title + '" has been reset');
	} catch (error) {
		console.error('Error resetting recurring task:', error);
		this.showNotification('Error resetting recurring task!');
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

FrustrationToTasksApp.prototype.applyFilters = function () {
	this.updateTasksDisplay();
};

FrustrationToTasksApp.prototype.clearCompletedTasks = async function () {
	try {
		const { error } = await this.supabase
			.from('tasks')
			.delete()
			.eq('completed', true);

		if (error) throw error;

		this.tasks = this.tasks.filter((task) => !task.completed);
		this.updateTasksDisplay();
		this.updateStats();
		this.updatePriorityBreakdown();
		this.updateRecentCompletions();
		this.showNotification('Completed tasks cleared!');
	} catch (error) {
		console.error('Error clearing completed tasks:', error);
		this.showNotification('Error clearing completed tasks!');
	}
};

FrustrationToTasksApp.prototype.exportTasks = function () {
	var data = {
		tasks: this.tasks,
		allVents: this.allVents,
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

FrustrationToTasksApp.prototype.loadVentToInput = function (ventId) {
	for (var i = 0; i < this.allVents.length; i++) {
		if (this.allVents[i].id == ventId) {
			document.getElementById('frustration-input').value =
				this.allVents[i].text;
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

	// Show custom prompt or default prompt in the textarea
	var promptInput = document.getElementById('custom-prompt-input');
	if (this.customPrompt) {
		promptInput.value = this.customPrompt;
	} else {
		promptInput.value = this.getDefaultPrompt();
	}
	promptInput.placeholder = 'Enter your custom prompt here...';
};

FrustrationToTasksApp.prototype.hideSettingsModal = function () {
	document.getElementById('settings-modal').classList.remove('active');
};

FrustrationToTasksApp.prototype.getDefaultPrompt = function () {
	return `You are a helpful assistant that converts people's frustrations and complaints into actionable tasks. 

Please analyze the following collection of frustrations/vents and convert them into a comprehensive set of specific, actionable tasks that could help address the underlying issues across ALL the frustrations.

Look for patterns, common themes, and root causes across all the frustrations. Create tasks that address the root causes, but focus more on things that are immediately doable, not things that require too much planning or organization.

If there are existing task notes provided, consider them when creating new tasks - they may provide additional context, progress updates, or insights that should influence the task recommendations.

For each task, provide:
- title: A clear, concise title (don't use initcaps for every word)
- description: A longer, detailed description that explains what needs to be done, why it's important, and any helpful context, tips, or suggestions. This will be shown in a collapsible panel when the user wants more details.
- category: One of these categories: Learning, Action, Problem Solving, Goals, Simplification, Organization, Communication, Planning, Research, or General
- priority: low, medium, or high
- recurring: Set to "none" for one-time tasks, or "daily", "weekly", or "monthly" for recurring tasks. Use recurring tasks for habits, maintenance, or regular check-ins that would help prevent similar frustrations.
- subtasks: An optional array of subtasks to break down complex tasks into smaller steps. Each subtask should be a simple, actionable step.

Frustrations:
{text}`;
};

FrustrationToTasksApp.prototype.resetPrompt = function () {
	var promptInput = document.getElementById('custom-prompt-input');
	promptInput.value = this.getDefaultPrompt();
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

FrustrationToTasksApp.prototype.updateAllVentsDisplay = function () {
	var allVentsList = document.getElementById('all-vents-list');
	var placeholder = document.getElementById('no-vents-placeholder');

	if (this.allVents.length === 0) {
		allVentsList.innerHTML = '';
		placeholder.style.display = 'block';
		return;
	}

	placeholder.style.display = 'none';

	var html = '';
	for (var i = 0; i < this.allVents.length; i++) {
		var vent = this.allVents[i];
		var formattedDate =
			new Date(vent.date).toLocaleDateString() +
			' ' +
			new Date(vent.date).toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			});

		html +=
			'<div class="vent-item">' +
			'<div class="vent-header">' +
			'<div class="vent-date">' +
			formattedDate +
			'</div>' +
			'</div>' +
			'<div class="vent-text">' +
			vent.text +
			'</div>' +
			'<div class="vent-actions">' +
			'<button class="vent-action-btn" onclick="app.loadVentToInput(' +
			vent.id +
			')">Load to Input</button>' +
			'<button class="vent-action-btn delete" onclick="app.deleteVent(' +
			vent.id +
			')">Delete</button>' +
			'</div>' +
			'</div>';
	}
	allVentsList.innerHTML = html;
};

FrustrationToTasksApp.prototype.deleteVent = async function (ventId) {
	if (confirm('Are you sure you want to delete this vent?')) {
		try {
			const { error } = await this.supabase
				.from('vents')
				.delete()
				.eq('id', ventId);

			if (error) {
				console.error('Error deleting vent from Supabase:', error);
				this.showNotification('Error deleting vent!');
				return;
			}

			this.allVents = this.allVents.filter(function (vent) {
				return vent.id != ventId;
			});
			this.saveToStorage('allVents', this.allVents);
			this.updateAllVentsDisplay();
			this.showNotification('Vent deleted successfully!');
		} catch (error) {
			console.error('Error in deleteVent:', error);
			this.showNotification('Error deleting vent!');
		}
	}
};

FrustrationToTasksApp.prototype.clearAllVents = async function () {
	if (
		confirm('Are you sure you want to clear all vents? This cannot be undone.')
	) {
		try {
			const { error } = await this.supabase.from('vents').delete().neq('id', 0); // Delete all rows

			if (error) {
				console.error('Error clearing vents from Supabase:', error);
				this.showNotification('Error clearing vents!');
				return;
			}

			this.allVents = [];
			this.saveToStorage('allVents', this.allVents);
			this.updateAllVentsDisplay();
			this.showNotification('All vents cleared!');
		} catch (error) {
			console.error('Error in clearAllVents:', error);
			this.showNotification('Error clearing vents!');
		}
	}
};

FrustrationToTasksApp.prototype.exportVents = function () {
	var data = {
		vents: this.allVents,
		exportDate: new Date().toISOString(),
	};

	var blob = new Blob([JSON.stringify(data, null, 2)], {
		type: 'application/json',
	});
	var url = URL.createObjectURL(blob);
	var a = document.createElement('a');
	a.href = url;
	a.download =
		'frustration-vents-' + new Date().toISOString().split('T')[0] + '.json';
	a.click();
	URL.revokeObjectURL(url);

	this.showNotification('Vents exported successfully!');
};

FrustrationToTasksApp.prototype.editTaskNotes = function (taskId) {
	var task = null;
	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			task = this.tasks[i];
			break;
		}
	}

	if (!task) return;

	// Store current task ID for saving
	this.editingTaskId = taskId;

	// Show modal and populate with existing notes
	this.showTaskNotesModal();
	document.getElementById('task-notes-input').value = task.notes || '';
	document.getElementById('task-notes-title').textContent =
		'Notes for: ' + task.title;
};

FrustrationToTasksApp.prototype.showTaskNotesModal = function () {
	document.getElementById('task-notes-modal').classList.add('active');
};

FrustrationToTasksApp.prototype.hideTaskNotesModal = function () {
	document.getElementById('task-notes-modal').classList.remove('active');
	this.editingTaskId = null;
};

FrustrationToTasksApp.prototype.saveTaskNotes = async function () {
	if (!this.editingTaskId) return;

	const notes = document.getElementById('task-notes-input').value.trim();

	try {
		const { error } = await this.supabase
			.from('tasks')
			.update({ notes: notes })
			.eq('id', this.editingTaskId);

		if (error) throw error;

		// Update local state
		const task = this.tasks.find((t) => t.id === this.editingTaskId);
		if (task) {
			task.notes = notes;
		}

		this.updateTasksDisplay();
		this.hideTaskNotesModal();
		this.showNotification('Notes saved successfully!');
	} catch (error) {
		console.error('Error saving task notes:', error);
		this.showNotification('Error saving notes!');
	}
};

FrustrationToTasksApp.prototype.addSubtask = function (taskId) {
	var subtaskText = prompt('Enter subtask:');
	if (!subtaskText || !subtaskText.trim()) return;

	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			if (!this.tasks[i].subtasks) {
				this.tasks[i].subtasks = [];
			}
			this.tasks[i].subtasks.push({
				text: subtaskText.trim(),
				completed: false,
				id: Date.now() + Math.random(),
			});
			break;
		}
	}

	this.saveToStorage('tasks', this.tasks);
	this.updateTasksDisplay();
	this.showNotification('Subtask added successfully!');
};

FrustrationToTasksApp.prototype.toggleSubtask = function (
	taskId,
	subtaskIndex
) {
	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			if (this.tasks[i].subtasks && this.tasks[i].subtasks[subtaskIndex]) {
				this.tasks[i].subtasks[subtaskIndex].completed =
					!this.tasks[i].subtasks[subtaskIndex].completed;
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

FrustrationToTasksApp.prototype.deleteSubtask = function (
	taskId,
	subtaskIndex
) {
	if (!confirm('Are you sure you want to delete this subtask?')) return;

	for (var i = 0; i < this.tasks.length; i++) {
		if (this.tasks[i].id === taskId) {
			if (this.tasks[i].subtasks && this.tasks[i].subtasks[subtaskIndex]) {
				this.tasks[i].subtasks.splice(subtaskIndex, 1);
			}
			break;
		}
	}

	this.saveToStorage('tasks', this.tasks);
	this.updateTasksDisplay();
	this.showNotification('Subtask deleted successfully!');
};

// Add new method to load vents from Supabase
FrustrationToTasksApp.prototype.loadVentsFromSupabase = async function () {
	try {
		const { data, error } = await this.supabase
			.from('vents')
			.select('*')
			.order('date', { ascending: false });

		if (error) {
			console.error('Error loading vents from Supabase:', error);
			// Fallback to local storage if Supabase fails
			return;
		}

		this.allVents = data;
		// Update local storage as backup
		this.saveToStorage('allVents', this.allVents);
	} catch (error) {
		console.error('Error in loadVentsFromSupabase:', error);
	}
};

// Add new method to load tasks from Supabase
FrustrationToTasksApp.prototype.loadTasksFromSupabase = async function () {
	try {
		const { data, error } = await this.supabase
			.from('tasks')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error loading tasks from Supabase:', error);
			return;
		}

		this.tasks = data;
		// Update local storage as backup
		this.saveToStorage('tasks', this.tasks);
	} catch (error) {
		console.error('Error in loadTasksFromSupabase:', error);
	}
};

// Add new function to generate tasks from vents
FrustrationToTasksApp.prototype.generateTasksFromVents = async function () {
	if (!this.apiKey) {
		this.showNotification('Please configure your API key in settings first!');
		this.showSettingsModal();
		return;
	}

	this.showProcessingModal();

	var allVentsText = this.allVents.map((vent) => vent.text);

	if (allVentsText.length === 0) {
		this.hideProcessingModal();
		this.showNotification('No vents found to process');
		return;
	}

	try {
		const newTasks = await this.extractTasksFromAllFrustrations(allVentsText);

		// Prepare tasks for Supabase insertion
		const tasksToInsert = newTasks.map((task) => ({
			title: task.title,
			description: task.description,
			category: task.category,
			priority: task.priority,
			recurring: task.recurring || 'none',
			completed: false,
			created_at: new Date().toISOString(),
			subtasks: task.subtasks || [],
		}));

		// Insert tasks into Supabase
		const { data: insertedTasks, error: taskError } = await this.supabase
			.from('tasks')
			.insert(tasksToInsert)
			.select();

		if (taskError)
			throw new Error('Error inserting tasks: ' + taskError.message);

		// Update local tasks array with Supabase data
		this.tasks = insertedTasks;

		// Update processed status for vents in Supabase
		const { error: ventError } = await this.supabase
			.from('vents')
			.update({ processed: true })
			.in(
				'id',
				this.allVents.map((v) => v.id)
			);

		if (ventError)
			throw new Error('Error updating vent status: ' + ventError.message);

		// Update local vents array
		this.allVents.forEach((vent) => {
			vent.processed = true;
		});

		// Update local storage as backup
		this.saveToStorage('tasks', this.tasks);
		this.saveToStorage('allVents', this.allVents);

		this.hideProcessingModal();
		this.updateTasksDisplay();
		this.showNotification(
			'Generated ' +
				newTasks.length +
				' actionable tasks from ' +
				allVentsText.length +
				' frustrations!'
		);
	} catch (error) {
		console.error('Error generating tasks:', error);
		this.hideProcessingModal();
		this.showNotification('Error generating tasks: ' + error.message);
	}
};

// Initialize the app
var app = new FrustrationToTasksApp();

// Add CSS for toast animations
var style = document.createElement('style');
style.textContent =
	'@keyframes slideInRight { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } } @keyframes slideOutRight { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }';
document.head.appendChild(style);
