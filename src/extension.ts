'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReviewPointManager } from './reviewPointManager';


let _context: vscode.ExtensionContext;

let reviewPointManager: ReviewPointManager;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-review" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json

    context.subscriptions.push(vscode.commands.registerCommand('review.showReviewPoints', () => {
        showManageWindow(context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('review.addReviewPoint', addReviewPoint));

    _context = context;

    reviewPointManager = new ReviewPointManager();

    vscode.workspace.onDidChangeTextDocument((e) =>{
        // CAUTION:
        // This event fires so frquently.
        // So return A.S.A.P if not nessesary!
        if(reviewPointManager) {
            if(reviewPointManager.belongsTo(vscode.workspace.asRelativePath(e.document.uri.fsPath)) == true){
                if(e.contentChanges.length > 0) {
                    let updated = reviewPointManager.updateRanges(
                        vscode.workspace.asRelativePath(e.document.uri.fsPath), 
                        e.contentChanges[0].range, 
                        e.contentChanges[0].text);

                    if(updated === true) {
                        wv_panel!.webview.html = getManageWindowHtml(context);
                    }
                }
            }
        }
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}

let wv_panel: vscode.WebviewPanel | undefined = undefined;

function showManageWindow(context: vscode.ExtensionContext) {
    if (wv_panel) {
        // update html
        wv_panel.webview.html = getManageWindowHtml(context);
        if (!wv_panel.visible) {
            wv_panel.reveal();
        }
    }
    else {
        // create and show webview panel
        wv_panel = vscode.window.createWebviewPanel(
            "rgDetailSearch", "Review Point List", vscode.ViewColumn.Beside, { enableScripts: true });

        // update html
        wv_panel.webview.html = getManageWindowHtml(context);

        // Handle messages from the webview
        wv_panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'jump':
                    let rp = reviewPointManager.findById(message.id);
                    if (rp) {
                        openFileWithRange(rp.file, rp.range);
                    }
                    return;
                case 'comment':
                    reviewPointManager.updateComment(message.id, message.comment);
                    return;
                case 'remove':
                    reviewPointManager.remove(message.id);
                    // update html
                    if (wv_panel) {
                        wv_panel.webview.html = getManageWindowHtml(context);
                    }
                    return;
            }
        });

        // Release the wv_panel when that is disposed
        wv_panel.onDidDispose(() => {
            wv_panel = undefined;
        });
    }
}

function addReviewPoint() {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        reviewPointManager.add(
            vscode.workspace.asRelativePath(editor.document.uri.fsPath),
            new vscode.Range(editor.selection.start, editor.selection.end));
        
        showManageWindow(_context);
    }
}

function getManageWindowHtml(context: vscode.ExtensionContext) {
    let html = fs.readFileSync(
        vscode.Uri.file(path.join(context.extensionPath, 'html', 'manageWindow.html')).fsPath,
        'utf8');

    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    $("#rptable").html(reviewPointManager.getAsHtml());

    return $.html();
}

let current_decorator : vscode.TextEditorDecorationType | undefined = undefined;

function openFileWithRange(file: string, range: vscode.Range) {
    if (vscode.workspace.workspaceFolders) {
        // NOTICE: We still don't support the multi-root and only look at the first workspace folder for now.
        if (vscode.workspace.workspaceFolders.length >= 1) {
            let workspace_path = vscode.workspace.workspaceFolders[0].uri.fsPath;
            vscode.workspace.openTextDocument(path.join(workspace_path, file)).then(document => {
                vscode.window.showTextDocument(document, vscode.ViewColumn.One).then((editor) => {

                    if(current_decorator) {
                        // remove previous highlight 
                        current_decorator.dispose();
                    }
                    // heighlight range
                    current_decorator = vscode.window.createTextEditorDecorationType({
                        'borderWidth': '1px',
                        'borderRadius': '2px',
                        'borderStyle': 'solid',
                        'light': {
                            'backgroundColor': 'rgba(58, 70, 101, 0.3)',
                            'borderColor': 'rgba(58, 70, 101, 0.4)',
                            'color': 'rgba(255, 0, 0, 1.0)'
                        },
                        'dark': {
                            'backgroundColor': 'rgba(117, 141, 203, 0.3)',
                            'borderColor': 'rgba(117, 141, 203, 0.4)',
                            'color': 'rgba(255, 255, 0, 1.0)'
                        }
                    });
                    editor.setDecorations(current_decorator, [range]);

                    // move cursor
                    const position = editor.selection.active;
                    let newPosition = position.with(range.start.line, range.start.character);
                    let newSelection = new vscode.Selection(newPosition, newPosition);
                    editor.selection = newSelection;

                    editor.revealRange(range);
                });
            });
        }
    }
}