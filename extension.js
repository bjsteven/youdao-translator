// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode  = require('vscode');
var request = require('request');
var api     = 'http://dict.youdao.com/w/eng/';
var cache   = {};

function encodeText(text) {
    return encodeURI(text.replace(/['"]/g, '').replace(/\/\//g, ' ').trim());
}

// 已经查询过的单词, mouseover会显示出来
function hover() {
    vscode.languages.registerHoverProvider('*', {
        provideHover(document, position) {
            let str  = document.getText(vscode.window.activeTextEditor.selection);
            str = encodeText(str);
            if (str !== '' && cache[str]) {
                return new vscode.Hover(cache[str].replace('\n',': '));
            } 

            let str2 = document.getText(document.getWordRangeAtPosition(position));
            str2 = encodeText(str2);
            if (cache[str2]) {
                return new vscode.Hover(cache[str2].replace('\n', ': '));
            }
        }
    });
}

function result(msg, url, text) {
    const soundBaseAPI = 'http://dict.youdao.com/dictvoice?audio='
    if (!result.channel) {
        result.channel = vscode.window.createOutputChannel('youdao-translator');
    }
    
    result.channel.clear(); 
    result.channel.appendLine(msg)
    result.channel.appendLine('-----------------------------------------')
    result.channel.appendLine('连接: ' + url + 
        '\n-----------------------------------------');
    // result.channel.hide()

    vscode.window.showInformationMessage(msg, {modal: true}, '空格键-播放语音', '访问连接')
        .then(function(str){
            result.channel.show();
            if (str === '空格键-播放语音') {
                var _url = soundBaseAPI + text + '&type=3'
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(_url));
            }
            else if (str === '访问连接') {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
            }
        });
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "youdao-translator" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var disposable = vscode.commands.registerCommand('extension.youdaoTranslate', function () {
        // The code you place here will be executed every time your command is executed
        var editor = vscode.window.activeTextEditor;

        if (!editor) {
            return console.log('no open text editor!');
        }

        var selection = editor.selection;
        var text = editor.document.getText(selection);

        if (!text) return;
        text = encodeText(text);
        var url = api + text;

        if (cache[text]) return result(cache[text], url);
        
        request.get(url, function (err, res, body) {
            if (err) return result('错误：' + err.message, url);
            try {
                // 单词
                // <h2 class="wordbook-js">...<div class="trans-container">...</div>
                var msg = body.replace(
                    /^[\s\S]*<h2 class="wordbook-js">([\s\S]*?)<div\s+class="trans-container">([\s\S]*?)<\/div>[\s\S]*$/g,
                    '$1###$2'
                );
                if (msg !== body) {
                    msg = msg.replace(/<\/?\s?[^>]+>/g, '').replace(/\s+/g, ' ').replace('###', "\n").trim();
                    cache[text] = msg;
                    return result(msg, url, text);
                }
                // 句子
                // <div id="fanyiToggle">...</div>
                msg = body.replace(
                    /^[\s\S]*<div id="fanyiToggle">([\s\S]*?)<\/div>[\s\S]*$/g,
                    '$1'
                );
                if (msg !== body) {
                    msg = msg.replace(/<\/p>/g, '###').replace(/<\/?\s?[^>]+>/g, '')
                        .replace(/\s+/g, ' ').replace(/###/g, "\n")
                        .replace(/以上为机器翻译结果，长、整句建议使用 人工翻译.*/g, '')
                        .trim();
                    cache[text] = msg;
                    return result(msg, url);
                }
                return result('错误：匹配翻译内容失败', url);

            } catch (e) {
                return result('错误：' + e.message, url);
            }

        });

    });

    context.subscriptions.push(disposable);
    hover();
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
