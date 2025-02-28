Dropzone.options.test = {
	autoProcessQueue: false,
	acceptedFiles: ".py,.llsp3",
	addRemoveLinks: true,
	maxFiles: 1,

	init: function () {
		let dzInstance = this;
		const notificationEl = document.getElementById("notification");
		const downloadBtn = document.getElementById("download-btn");
        const copyBtn = document.getElementById("copy-btn");
		const mainContentEl = document.getElementById("main-content");

		// Store initial content
		const initialMainContent = mainContentEl.innerHTML;

		// Initially hide and disable buttons
		downloadBtn.style.display = "none";
		copyBtn.style.display = "none";

		function enableButtons(filename, content) {
			downloadBtn.style.display = "inline-block";
			copyBtn.style.display = "inline-block";

			// Update download button
			let mdFilename = filename.replace(/\.\w+$/, ".md"); // Change extension to .md
			let blob = new Blob([content], { type: "text/markdown" });
			let url = URL.createObjectURL(blob);
			
			downloadBtn.href = url;
			downloadBtn.download = mdFilename;

			// Copy to clipboard on button click
			copyBtn.addEventListener("click", function () {
				navigator.clipboard.writeText(content).then(() => {
					showNotification("Markdown copied to clipboard!");
				}).catch(err => {
					showNotification("Failed to copy: " + err.message);
				});
			});
		}

		async function loadPyodideAndScript() {
			let pyodide = await loadPyodide();  

			// Load and execute script.py in Pyodide
			let response = await fetch('script.py');
			let scriptCode = await response.text();
			await pyodide.runPythonAsync(scriptCode);

			return pyodide; 
		}

		async function extractPythonFromLLSP3(file) {
			let zip = new JSZip();
			let zipContents = await zip.loadAsync(file);
			if (!zipContents.files["projectbody.json"]) {
				throw new Error("Invalid LLSP3 file: projectbody.json not found.");
			}
			let jsonData = await zipContents.files["projectbody.json"].async("text");
			let projectData = JSON.parse(jsonData);
			return projectData["main"] || "No Python code found in 'main' key.";
		}

		async function processUploadedFile(file) {
			let fileExtension = file.name.split('.').pop().toLowerCase();
			let fileContent = "";

			if (fileExtension === "py") {
				fileContent = await file.text();
			} else if (fileExtension === "llsp3") {
				fileContent = await extractPythonFromLLSP3(file);
			} else {
				throw new Error("Unsupported file format.");
			}

			return fileContent;
		}

		async function runPythonWithScript(fileContent) {
			let pyodide = await loadPyodideAndScript(); 

			let safeFileContent = fileContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			let pythonCommand = `
file_content = """${safeFileContent}"""
extract_python_docstrings(file_content)
			`;

			return await pyodide.runPythonAsync(pythonCommand); 
		}

		function clearNotification() {
			notificationEl.textContent = "";
		}

		function showNotification(message) {
			notificationEl.textContent = message;
			setTimeout(clearNotification, 3000);
		}

		this.on("addedfile", function (file) {
			clearNotification();

			if (dzInstance.files.length > 1) {
				dzInstance.removeFile(dzInstance.files[0]);
			}

			processUploadedFile(file)
				.then(async (fileContent) => {
					document.getElementById("main-content").textContent = "Processing file...";
					let result = await runPythonWithScript(fileContent);

					// Convert Markdown to HTML and display it
					document.getElementById("main-content").innerHTML = marked.parse(result);

					// Enable buttons with filename and content
					enableButtons(file.name, result);
				})
				.catch((err) => {
					document.getElementById("main-content").textContent = "Error: " + err.message;
				});
		});

		this.on("removedfile", function () {
			mainContentEl.innerHTML = initialMainContent; // Restore initial content
			//document.getElementById("main-content").textContent = "";
			
			// Hide and disable buttons
			downloadBtn.style.display = "none";
			copyBtn.style.display = "none";
		});

		this.on("maxfilesexceeded", function (file) {
			showNotification("Only one file can be uploaded at a time.");
			dzInstance.removeFile(file);
		});
	}
};