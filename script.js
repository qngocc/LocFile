function checkDuplicate() {
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');

    if (fileInput.files.length === 0) {
        displayMessage(resultDiv, 'Vui lòng chọn tệp.', 'error');
        return;
    }

    const file = fileInput.files[0];
    const fileType = file.type;

    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        readDocx(file, resultDiv);
    } else if (fileType === 'text/plain') {
        readTxt(file, resultDiv);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        readExcel(file, resultDiv);
    } else if (fileType === 'application/pdf') {
        readPdf(file, resultDiv);
    } else {
        displayMessage(resultDiv, 'Vui lòng chọn tệp .txt, .docx, .xlsx hoặc .pdf.', 'error');
    }
}

function readDocx(file, resultDiv) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const arrayBuffer = event.target.result;
        mammoth.extractRawText({ arrayBuffer: arrayBuffer })
            .then(result => processText(result.value, resultDiv))
            .catch(() => displayMessage(resultDiv, 'Đã xảy ra lỗi khi đọc tệp Word.', 'error'));
    };
    reader.readAsArrayBuffer(file);
}

function readTxt(file, resultDiv) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const text = event.target.result;
        processText(text, resultDiv);
    };
    reader.onerror = () => displayMessage(resultDiv, 'Đã xảy ra lỗi khi đọc tệp.', 'error');
    reader.readAsText(file);
}

function readExcel(file, resultDiv) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const text = XLSX.utils.sheet_to_json(sheet, { header: 1 }).map(row => row.join(' ')).join('\n');
        processText(text, resultDiv);
    };
    reader.onerror = () => displayMessage(resultDiv, 'Đã xảy ra lỗi khi đọc tệp Excel.', 'error');
    reader.readAsArrayBuffer(file);
}

function readPdf(file, resultDiv) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const uint8Array = new Uint8Array(event.target.result);
        pdfjsLib.getDocument(uint8Array).promise.then(pdf => {
            let text = '';
            let promises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                promises.push(pdf.getPage(i).then(page => {
                    return page.getTextContent().then(content => {
                        content.items.forEach(item => {
                            text += item.str + ' ';
                        });
                    });
                }));
            }
            Promise.all(promises).then(() => {
                processText(text, resultDiv);
            });
        }).catch(() => displayMessage(resultDiv, 'Đã xảy ra lỗi khi đọc tệp PDF.', 'error'));
    };
    reader.readAsArrayBuffer(file);
}

function processText(text, resultDiv) {
    const lines = parseTextToLines(text);
    const duplicateParts = findDuplicateParts(lines);

    if (duplicateParts.length > 0) {
        let htmlContent = '';
        duplicateParts.forEach((part, index) => {
            htmlContent += `
                <div class="duplicate">
                    <div class="question-short"><strong>Trùng lặp ${index + 1}:</strong> ${part.shortQuestion}</div>
                    <div class="question-full">${part.fullQuestion}</div>
                </div>
            `;
        });
        displayMessage(resultDiv, htmlContent);
    } else {
        displayMessage(resultDiv, 'Không có phần trùng lặp nào.');
    }
}

function parseTextToLines(text) {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== "");
}

function findDuplicateParts(lines) {
    const seen = new Map();
    const duplicates = [];

    for (let i = 0; i < lines.length; i++) {
        const questionPart = extractQuestionPart(lines[i]);
        const cleanedLine = cleanText(questionPart);

        if (seen.has(cleanedLine)) {
            seen.get(cleanedLine).push(lines[i]);
        } else {
            seen.set(cleanedLine, [lines[i]]);
        }
    }

    seen.forEach((values, key) => {
        if (values.length > 1) {
            duplicates.push({
                fullQuestion: values.join(' '),
                shortQuestion: extractShortQuestion(values[0])
            });
        }
    });

    return duplicates;
}

function cleanText(text) {
    return text.replace(/^[0-9]+\.\s*/, '').toLowerCase();
}

function extractQuestionPart(text) {
    const questionPart = text.split("?")[0].trim();
    return questionPart;
}

function extractShortQuestion(text) {
    return text.split("?")[0].trim();
}

function displayMessage(element, message, type = 'success') {
    element.innerHTML = message;
    element.className = type === 'error' ? 'error' : 'result';
}