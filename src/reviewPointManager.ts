'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type KeyValuePair = { key: string, value: any };

export class ReviewPoint {

    // These information should be refered only from current version.
    readonly id: string;
    public options: KeyValuePair[] = [];
    public add_time: Date | undefined = undefined; // should be set once when added first version
    public done_time: Date | undefined = undefined; // should be updated when committed as reviewee
    public isClosed: boolean;
    public history: ReviewPoint[] = []; // The head of the list is recent one and tail is oldest one.

    // These information should be refered from each versions.
    public version: number; // The version of review that this rp was added(or updated).
    public file: string;
    public range: vscode.Range;
    public comment: string; // The content of point out.
    public author: string; // The person who added(or updated) this rp.

    setAddTime() {
        if (this.add_time === undefined) { this.add_time = new Date(Date.now()); }
    }

    updateDoneTime() {
        this.done_time = new Date(Date.now());
    }

    getAddTime() {
        return this.add_time;
    }

    getDoneTime() {
        return this.done_time;
    }

    constructor(
        version: number,
        file: string,
        range: vscode.Range,
        comment?: string,
        id?: string,
        isClosed?: boolean,
        author?: string) {

        this.version = version;
        this.file = file;
        this.range = range;

        if (!comment) {
            this.comment = "add comment here.";
        }
        else {
            this.comment = comment;
        }

        if (!id) {
            const shortid = require('shortid');
            this.id = shortid.generate();
        }
        else {
            this.id = id;
        }

        if (!isClosed) {
            this.isClosed = false;
        }
        else {
            this.isClosed = isClosed;
        }

        if (!author) {
            this.author = this.getUserName();
        }
        else {
            this.author = author;
        }
    }

    public commit(current_version: number) {
        this.author = this.getUserName(); // update author to committer
        this.history.push(this.deepcopy());
        this.reflesh(current_version);
    }

    private getUserName(): string {
        let username = vscode.workspace.getConfiguration("review", null).get<string>("username");

        if (username === "") {
            const os = require("os");
            username = os.userInfo().username;
        }

        if (!username) {
            username = "undefined";
        }

        return username;
    }


    public revert(): boolean {
        if (this.history.length !== 0) {
            let prev_rp = this.history.pop();
            this.version = prev_rp!.version;
            this.file = prev_rp!.file;
            this.range = new vscode.Range(
                new vscode.Position(prev_rp!.range.start.line, prev_rp!.range.start.character),
                new vscode.Position(prev_rp!.range.end.line, prev_rp!.range.end.character));
            this.comment = prev_rp!.comment;
            this.isClosed = prev_rp!.isClosed;
            this.author = prev_rp!.author;

            return true;
        }
        else {
            // cannot revert because history is empty
            return false;
        }
    }

    public reflesh(current_version: number) {
        this.version = current_version;
        this.comment = "add comment here.";
    }

    public deepcopy(): ReviewPoint {
        return new ReviewPoint(
            this.version,
            this.file,
            new vscode.Range(
                new vscode.Position(this.range.start.line, this.range.start.character),
                new vscode.Position(this.range.end.line, this.range.end.character)),
            this.comment,
            this.id,
            this.isClosed,
            this.author);
    }

    public initializeOption(context: vscode.ExtensionContext) {
        try {

            let optionformat = RpOptionConverter.loadOptionsAsArrayObject(context);
            optionformat.forEach((element: any) => {
                this.options.push({
                    key: element!.id,
                    value: element!.defaultValue
                });
            });
        }
        catch (e) {
            vscode.window.showErrorMessage("parsing of optionalFormat.json was failed.\n" + e.message);
        }
    }

    public updateOption(key: string, value: any) {
        let tgt = this.options[this.options.findIndex(x => { return x.key === key; })];

        if (tgt) {
            tgt.key = key;
            tgt.value = value;
        }
    }
}

export class RpJsonConverter {
    public static createFromJsonObj(obj: any) {
        let rp = new ReviewPoint(
            obj.version,
            obj.file,
            new vscode.Range(
                new vscode.Position(obj.range[0].line, obj.range[0].character),
                new vscode.Position(obj.range[1].line, obj.range[1].character)),
            obj.comment,
            obj.id,
            obj.isClosed,
            obj.author);

        obj.history.forEach((h: any) => {
            rp.history.push(
                new ReviewPoint(h.version, h.file,
                    new vscode.Range(
                        new vscode.Position(h.range[0].line, h.range[0].character),
                        new vscode.Position(h.range[1].line, h.range[1].character)), h.comment, h.id, h.isClosed, h.author));
        });

        obj.options.forEach((opt: any) => {
            rp.options.push({ key: opt.key, value: opt.value });
        });

        if (obj.add_time) {
            rp.add_time = obj.add_time;
        }

        if (obj.done_time) {
            rp.done_time = obj.done_time;
        }

        return rp;
    }
}

class RpHtmlConverter {
    public static getAsHtml(context: vscode.ExtensionContext, rp :ReviewPoint) {
        let html: string = "";

        if (rp.isClosed === true) {
            html += "<tr><td><div class='rp_frame rp_closed'>";
        }
        else {
            html += "<tr><td><div class='rp_frame'>";
        }
        html += "<div class='btn-container'>";
        // octicon:https://octicons.github.com/
        // below svg is hard copy of 'x.svg' of octicon.
        html += `<div title="Delete this review point."><svg class='remove x' id='rmv.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z'/></svg></div>`;
        // below svg is hard copy of 'check.svg' of octicon.
        html += `<div title="Close this review point."><svg class='close check' id='cls.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M12 5l-8 8-4-4 1.5-1.5L4 10l6.5-6.5L12 5z'/></svg></div>`;
        // below svg is hard copy of 'sync.svg' of octicon.
        html += `<div title="Update range of this review point with current selection."><svg class='revice sync tooltip' id='rev.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z'/></svg></div>`;
        html += "</div>";
        html += "<div id=" + rp.id + " class='rp'>";
        html += "<span class='item2'>file: </span>" + rp.file + "<br/>";
        html += "<span class='item2'>range: </span>(" + rp.range.start.line.toString() + ", ";
        html += rp.range.start.character.toString() + ") to (" + rp.range.end.line.toString() + ", " + rp.range.end.character.toString() + ")";
        html += "<br/>";
        html += "</div>";

        html += "<div onclick='obj=document.getElementById(\"optional." + rp.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
        html += "<a class='item2' style='cursor:pointer;'>▼show optional info</a>";
        html += "</div>";
        html += "<div id='optional." + rp.id + "' class='optional'>";
        html += RpOptionConverter.getOptionsAsHtml(context, rp);
        html += "</div>";

        if (rp.isClosed === true) {
            html += "<div onclick='obj=document.getElementById(\"comments." + rp.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
            html += "<a class='item2' style='cursor:pointer;'>▼show comments</a>";
            html += "</div>";
            html += "<div id='comments." + rp.id + "' class='closedComments'>";
        }
        rp.history.forEach(e => {
            html += "<span class='item2 ver" + e.version + "'>history(ver." + e.version + ") by " + e.author + ": </span><br/>";
            html += "<div class='history'>" + e.comment + "</div>";
        });
        if (rp.isClosed !== true) {
            html += "<span class='item2 ver" + rp.version + "'>comment(ver." + rp.version + ") by " + rp.author + ": </span><br/>";
            html += "<div class='comment' id='cmt." + rp.id + "'>" + rp.comment + "</div>";
        } else {
            html += "</div>";
            html += "<span class='item2'>this review point was closed at ver." + rp.version + " by " + rp.author + "</span><br/>";
        }

        html += "</div></td></tr>";

        return html;
    }

    public static getAsHtmlInJpn(context: vscode.ExtensionContext, rp: ReviewPoint) {
        let html: string = "";

        if (rp.isClosed === true) {
            html += "<tr><td><div class='rp_frame rp_closed'>";
        }
        else {
            html += "<tr><td><div class='rp_frame'>";
        }
        html += "<div class='btn-container'>";
        // octicon:https://octicons.github.com/
        // below svg is hard copy of 'x.svg' of octicon.
        html += `<div title="レビューポイントを削除します"><svg class='remove x' id='rmv.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z'/></svg></div>`;
        // below svg is hard copy of 'check.svg' of octicon.
        html += `<div title="レビューポイントをクローズします"><svg class='close check' id='cls.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M12 5l-8 8-4-4 1.5-1.5L4 10l6.5-6.5L12 5z'/></svg></div>`;
        // below svg is hard copy of 'sync.svg' of octicon.
        html += `<div title="指摘位置を現在の選択範囲に更新します"><svg class='revice sync tooltip' id='rev.${rp.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z'/></svg></div>`;
        html += "</div>";
        html += "<div id=" + rp.id + " class='rp'>";
        html += "<span class='item2'>指摘ファイル: </span>" + rp.file + "<br/>";
        html += "<span class='item2'>指摘位置: </span>(" + rp.range.start.line.toString() + ", ";
        html += rp.range.start.character.toString() + ") to (" + rp.range.end.line.toString() + ", " + rp.range.end.character.toString() + ")";
        html += "<br/>";
        html += "</div>";

        html += "<div onclick='obj=document.getElementById(\"optional." + rp.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
        html += "<a class='item2' style='cursor:pointer;'>▼オプション情報を表示</a>";
        html += "</div>";
        html += "<div id='optional." + rp.id + "' class='optional'>";
        html += RpOptionConverter.getOptionsAsHtml(context, rp);
        html += "</div>";

        if (rp.isClosed === true) {
            html += "<div onclick='obj=document.getElementById(\"comments." + rp.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
            html += "<a class='item2' style='cursor:pointer;'>▼コメントを表示</a>";
            html += "</div>";
            html += "<div id='comments." + rp.id + "' class='closedComments'>";
        }
        rp.history.forEach(e => {
            html += "<span class='item2 ver" + e.version + "'>コメント履歴(ver." + e.version + ") by " + e.author + ": </span><br/>";
            html += "<div class='history'>" + e.comment + "</div>";
        });
        if (rp.isClosed !== true) {
            html += "<span class='item2 ver" + rp.version + "'>指摘コメント(ver." + rp.version + ") by " + rp.author + ": </span><br/>";
            html += "<div class='comment' id='cmt." + rp.id + "'>" + rp.comment + "</div>";
        } else {
            html += "</div>";
            html += "<span class='item2'>このレビューポイントはクローズ済みです。(ver." + rp.version + ", クローズ者: " + rp.author + ")</span><br/>";
        }

        html += "</div></td></tr>";

        return html;
    }
}

class RpOptionConverter{
    
    public static getOptionsAsHtml(context: vscode.ExtensionContext, rp :ReviewPoint) {

        let html: string = "<div>";

        let format = RpOptionConverter.loadOptionsAsArrayObject(context);

        format.forEach((element: any) => {

            // get current option's value
            let value: any;

            try {
                value = rp.options.find(x => { return x.key === element.id; })!.value;
            }
            catch
            {
                value = element.defaultValue;
            }

            if (element.type === 0) {
                // this option is gonna be a checkbox

                if (value === true) {
                    html += "<input type='checkbox' id='" + rp.id + "." + element.id + "' checked='checked' class='opt_chkbox'>" + element.name + "</input><br/>";
                }
                else {
                    html += "<input type='checkbox' id='" + rp.id + "." + element.id + "' class='opt_chkbox'>" + element.name + "</input><br/>";
                }
            }
            else if (element.type === 1) {
                // this option is gonna be a drop-down list

                html += "<span style='width: 200px; display: inline-block;'>" + element.name + ": </span>";
                html += "<div style='width: 200px; display: inline-block;'>";
                html += "<select class='opt_list cp_ipselect cp_sl01' id='" + rp.id + "." + element.id + "'>";

                element.listValues.forEach((elm: any) => {
                    if (elm.value.toString() === value.toString()) {
                        html += "<option value=" + elm.value + " selected>" + elm.name + "</option>";
                    }
                    else {
                        html += "<option value=" + elm.value + ">" + elm.name + "</option>";
                    }
                });

                html += "</select></div><br/>";

                // parse enableWhen setting and add corresponding js code to html
                if ("enableWhen" in element) {
                    html += "<script>";
                    html += "document.getElementById('" + rp.id + "." + element.id + "').disabled = true;";
                    element.enableWhen.caseValues.forEach((it: any) => {
                        html += "if(document.getElementById('" + rp.id + "." + element.enableWhen.target + "').options[document.getElementById('" + rp.id + "." + element.enableWhen.target + "').selectedIndex].value === '" + it + "'){ document.getElementById('" + rp.id + "." + element.id + "').disabled = false; }";
                    });
                    html += "if(document.getElementById('" + rp.id + "." + element.id + "').disabled === true){";
                    html += "document.getElementById('" + rp.id + "." + element.id + "').selectedIndex = 0;";
                    html += "vscode.postMessage({";
                    html += "command: 'opt_list',";
                    html += "id: '" + rp.id + "." + element.id + "',";
                    html += "value: 0";
                    html += "});";
                    html += "}";
                    html += "document.getElementById('" + rp.id + "." + element.enableWhen.target + "').addEventListener('change', function() {";
                    html += "document.getElementById('" + rp.id + "." + element.id + "').disabled = true;";
                    element.enableWhen.caseValues.forEach((it: any) => {
                        html += "if(this.options[this.selectedIndex].value === '" + it + "'){ document.getElementById('" + rp.id + "." + element.id + "').disabled = false; }";
                    });
                    html += "if(document.getElementById('" + rp.id + "." + element.id + "').disabled === true){";
                    html += "document.getElementById('" + rp.id + "." + element.id + "').selectedIndex = 0;";
                    html += "vscode.postMessage({";
                    html += "command: 'opt_list',";
                    html += "id: '" + rp.id + "." + element.id + "',";
                    html += "value: 0";
                    html += "});";
                    html += "}";
                    html += "});";
                    html += "</script>";
                }
            }
        });

        html += "</div>";

        return html;
    }

    public static loadOptionsAsArrayObject(context: vscode.ExtensionContext) {
        return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "configuration", "optionalFormat.json")).toString());
    }
}

export class ReviewPointManager {

    public static REVIEWER = 0;
    public static REVIEWEE = 1;

    public rp_list: ReviewPoint[] = [];
    public history: string[] = []; // this can remove now because of no use!
    public commitMessages: string[] = [];

    public version: number = 0;

    public part: number[] = [ReviewPointManager.REVIEWER];

    constructor() {
        this.importIfExist();
    }

    public commit(save_path: string, message: string) {
        // save this version's workspace folder path
        this.history.push(vscode.workspace.workspaceFolders![0].uri.fsPath);
        this.commitMessages.push(message);
        this.part.push(this.getOppositePart()); // you should do this before updating version!
        this.version++;
        this.rp_list.forEach(element => {
            if (element.isClosed === false) {
                element.commit(this.version);
            }
        });

        this.export(save_path);
    }

    public revert(save_path: string) {
        if (this.version < 1) {
            return;
        }
        this.part.pop();
        this.history.pop();
        this.commitMessages.pop();

        let remove_id_list: string[] = [];
        this.rp_list.forEach(element => {
            if (element.isClosed === true) {
                if (element.version === this.version) {
                    if (element.history.length === 0) {
                        // remove element itself because history is now empty.
                        // !NOTICE: Do not remove element here because current outer Foreach gonna be broken!
                        remove_id_list.push(element.id);
                    }
                    else {
                        element.revert();
                    }
                }
            }
            else {
                if (element.history.length === 0) {
                    // remove element itself because history is now empty.
                    // !NOTICE: Do not remove element here because current outer Foreach gonna be broken!
                    remove_id_list.push(element.id);
                }
                else {
                    element.revert();
                }
            }
        });

        // remove elements in remove list
        remove_id_list.forEach(element => {
            this.rp_list.splice(this.rp_list.findIndex(it => { return it.id === element; }), 1);
        });
        this.version--;

        this.export(save_path);
    }

    public save(save_path: string) {
        this.export(save_path);
        vscode.window.showInformationMessage('Review points has been saved successfully!');
    }

    private export(save_path: string) {

        let save_dir = path.join(save_path, '.vscode');

        fs.exists(save_dir, (exists) => {
            if (exists === true) {
                fs.writeFile(path.join(save_path, '.vscode', 'vscode-review.json'), ReviewJsonConverter.getAsJSON(this), (err) => {

                    if (err) {
                        vscode.window.showErrorMessage(err.message);
                    }
                });
            }
            else {
                fs.mkdir(save_dir, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage(err.message);
                    }
                    else {
                        fs.writeFile(path.join(save_path, '.vscode', 'vscode-review.json'), ReviewJsonConverter.getAsJSON(this), (err) => {
                            if (err) {
                                vscode.window.showErrorMessage(err.message);
                            }
                        });
                    }
                });
            }
        });
    }

    private importIfExist() {
        try {
            let json: string = fs.readFileSync(
                path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".vscode", "vscode-review.json")).toString();
            if (ReviewJsonConverter.loadFromJSON(json, this) === true) {
                vscode.window.showInformationMessage("review file was loaded!");
            }
        }
        catch
        {
            return;
        }
    }

    public findById(id: string) {
        let rp = this.rp_list.find(x => { return x.id === id; });

        if (rp) {
            return this.rp_list[this.rp_list.indexOf(rp)];
        }
        else {
            return undefined;
        }
    }

    public updateComment(cmt_id: string, comment: string) {
        let rp = this.findById(cmt_id.replace("cmt.", ""));

        if (rp) {
            if (comment !== rp.comment) {
                rp.comment = comment;
                if (this.part[this.version] === ReviewPointManager.REVIEWEE) { rp.updateDoneTime(); }
            }
        }
    }

    public add(file: string, range: vscode.Range, context: vscode.ExtensionContext) {
        let rp = new ReviewPoint(this.version, file, range);
        rp.initializeOption(context);
        rp.setAddTime();
        this.rp_list.push(rp);
    }

    public close(cls_id: string) {
        let rp = this.findById(cls_id.replace("cls.", ""));

        if (rp!.isClosed === false) {
            rp!.isClosed = true;
        }
        else {
            if (rp!.version === this.version) {
                rp!.isClosed = false;
            }
        }
    }

    public remove(rmv_id: string) {
        let tgt = this.findById(rmv_id.replace("rmv.", ""));

        if (tgt) {
            this.rp_list.splice(this.rp_list.indexOf(tgt), 1);
        }
    }

    public belongsTo(file: string) {

        let idx = this.rp_list.findIndex(x => { return (x.file === file); });

        return idx >= 0;
    }

    public updateRanges(file: string, range: vscode.Range, text: string, document: vscode.TextDocument) {

        let updated = false;

        this.rp_list.forEach(element => {
            if (element.file === file) {
                let range_new = this.getNewRange(element, range, text);
                // getNewRange() returns `undefined` if this review point is not necessary to update
                if (range_new) {
                    this.findById(element.id)!.range = range_new;
                    updated = true;
                }
            }
        });

        return updated;
    }

    private calcNumOfLines(range: vscode.Range, text: string) {
        if (text === "") {
            return -(range.end.line - range.start.line);
        }

        let match = text.match(/(\r\n|\r|\n)/g);
        if (match) {
            return match.length;
        }

        return 0;
    }

    private calcNumOfChars(range: vscode.Range, text: string) {
        if (text === "") {
            return -(range.end.character - range.start.character);
        }

        return text.length;
    }

    private getNewRange(rp: ReviewPoint, range_chenged: vscode.Range, text_changed: string) {
        let range_new: vscode.Range | undefined = undefined;

        if (range_chenged.start.isBeforeOrEqual(rp.range.start) === true) {
            if (rp.range.start.line !== range_chenged.end.line) {
                // we only update line pos of original range
                let diff_of_lines = this.calcNumOfLines(range_chenged, text_changed);

                range_new = new vscode.Range(
                    new vscode.Position(rp.range.start.line + diff_of_lines, rp.range.start.character),
                    new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character)
                );
            }
            else {
                // we have to both line pos and char pos of original range
                let diff_of_lines = this.calcNumOfLines(range_chenged, text_changed);

                if (diff_of_lines > 0) {
                    // some lines were added
                    range_new = new vscode.Range(
                        new vscode.Position(rp.range.start.line + diff_of_lines, range_chenged.end.character),
                        new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character + range_chenged.end.character)
                    );
                }
                else if (diff_of_lines === 0) {
                    range_new = new vscode.Range(
                        new vscode.Position(rp.range.start.line, rp.range.start.character + this.calcNumOfChars(range_chenged, text_changed)),
                        new vscode.Position(rp.range.end.line, rp.range.end.character + ((rp.range.end.line === rp.range.start.line) ? this.calcNumOfChars(range_chenged, text_changed) : 0))
                    );
                }
                else {
                    // some lines were deleted
                    range_new = new vscode.Range(
                        new vscode.Position(rp.range.start.line + diff_of_lines, range_chenged.start.character),
                        new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character + range_chenged.start.character)
                    );
                }
            }
        }
        else if (range_chenged.intersection(rp.range)) {
            // there is overlap between range_changed and rp.range
            if (rp.range.end.line > range_chenged.end.line) {
                // we only update line pos of original range
                let diff_of_lines = this.calcNumOfLines(range_chenged, text_changed);

                range_new = new vscode.Range(
                    rp.range.start,
                    new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character)
                );
            }
            else {
                // we have to both line pos and char pos of original range
                let diff_of_lines = this.calcNumOfLines(range_chenged, text_changed);

                if (diff_of_lines > 0) {
                    // some lines were added
                    range_new = new vscode.Range(
                        rp.range.start,
                        new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character + (range_chenged.end.character - range_chenged.start.character))
                    );
                }
                else {
                    // some lines were deleted
                    range_new = new vscode.Range(
                        rp.range.start,
                        new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character + range_chenged.start.character)
                    );
                }
            }

        }

        return range_new;
    }

    public reviceRange(id: string, editor: vscode.TextEditor) {

        let tgt = this.findById(id.replace("rev.", ""));

        if (vscode.workspace.asRelativePath(editor.document.uri.fsPath) !== tgt!.file) {
            return;
        }

        tgt!.range = new vscode.Range(
            new vscode.Position(editor.selection.start.line, editor.selection.start.character),
            new vscode.Position(editor.selection.end.line, editor.selection.end.character));

    }

    public updateOption(id: string, value: any) {
        let sections = id.split(".");
        let rp_id = sections[0];
        let opt_key = sections[1];

        try {
            this.findById(rp_id)!.updateOption(opt_key, value);
        }
        catch
        {
            return false;
        }

        return true;
    }

    public switchCurrentPart() {
        this.part[this.version] = this.getOppositePart();
    }

    getOppositePart() {
        if (this.part[this.version] === ReviewPointManager.REVIEWEE) {
            return ReviewPointManager.REVIEWER;
        }
        else {
            return ReviewPointManager.REVIEWEE;
        }
    }
}

export class ReviewHtmlConverter{
    public static getAsHtml(context: vscode.ExtensionContext, manager :ReviewPointManager, refineBy?: string, sortBy?: string, value?: string) {
        let html: string = "";
        let list = undefined;

        if (refineBy === "unclosed") {
            list = manager.rp_list.filter((value) => {
                return value.isClosed === false;
            });
        }
        else if (refineBy === "closed") {
            list = manager.rp_list.filter((value) => {
                return value.isClosed === true;
            });
        }
        else if (refineBy === "refine.file") {
            list = manager.rp_list.filter((val) => {
                return val.file.includes(value!);
            });
        }
        else if (sortBy === "file") {
            list = manager.rp_list.slice().sort((a, b) => {
                if (a.file !== b.file) {
                    return (a.file < b.file) ? -1 : 1;
                }
                else {
                    return (a.range.start.isBefore(b.range.start)) ? -1 : 1;
                }
            });
        }
        else if (sortBy === "version") {
            list = manager.rp_list.slice().sort((a, b) => {
                let ver_a, ver_b;

                ver_a = (a.history === []) ? a.version : a.history[0].version;
                ver_b = (a.history === []) ? b.version : b.history[0].version;

                return ver_a - ver_b;
            });
        }
        else {
            list = manager.rp_list;
        }

        list!.forEach(element => {
            html += RpHtmlConverter.getAsHtml(context, element);
        });

        // distinguish between reviewer and reviewee
        html += "<style>";
        for (var i = 0; i <= manager.version; i++) {
            html += ".ver" + i + "{";
            if (manager.part[i] === ReviewPointManager.REVIEWER) {
                html += "color: var(--reviewer-color); font-weight: var(--person-font-weight);";
            }
            else {
                html += "color: var(--reviewee-color); font-weight: var(--person-font-weight);";
            }
            html += "}";
        }
        html += "</style>";

        return html;
    }

    public static getAsHtmlInJpn(context: vscode.ExtensionContext, manager :ReviewPointManager, refineBy?: string, sortBy?: string, value?: string) {
        let html: string = "";
        let list = undefined;

        if (refineBy === "unclosed") {
            list = manager.rp_list.filter((value) => {
                return value.isClosed === false;
            });
        }
        else if (refineBy === "closed") {
            list = manager.rp_list.filter((value) => {
                return value.isClosed === true;
            });
        }
        else if (refineBy === "refine.file") {
            list = manager.rp_list.filter((val) => {
                return val.file.includes(value!);
            });
        }
        else if (sortBy === "file") {
            list = manager.rp_list.slice().sort((a, b) => {
                if (a.file !== b.file) {
                    return (a.file < b.file) ? -1 : 1;
                }
                else {
                    return (a.range.start.isBefore(b.range.start)) ? -1 : 1;
                }
            });
        }
        else if (sortBy === "version") {
            list = manager.rp_list.slice().sort((a, b) => {
                let ver_a, ver_b;

                ver_a = (a.history === []) ? a.version : a.history[0].version;
                ver_b = (a.history === []) ? b.version : b.history[0].version;

                return ver_a - ver_b;
            });
        }
        else {
            list = manager.rp_list;
        }

        list!.forEach(element => {
            html += RpHtmlConverter.getAsHtmlInJpn(context, element);
        });

        // distinguish between reviewer and reviewee
        html += "<style>";
        for (var i = 0; i <= manager.version; i++) {
            html += ".ver" + i + "{";
            if (manager.part[i] === ReviewPointManager.REVIEWER) {
                html += "color: var(--reviewer-color); font-weight: var(--person-font-weight);";
            }
            else {
                html += "color: var(--reviewee-color); font-weight: var(--person-font-weight);";
            }
            html += "}";
        }
        html += "</style>";

        return html;
    }

    public static getSummaryAsHtml(manager: ReviewPointManager) {
        let html: string = "";
        html += "<span class='item2'>current version: </span>" + manager.version + "<br/>";
        html += "<div><span class='item2'>current part: </span>";
        if (manager.part[manager.version] === ReviewPointManager.REVIEWER) {
            html += "<label><input type='radio' name='partRadioBtn' value='0' checked='checked'>reviewer</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'>reviewee</label>";
        }
        else {
            html += "<label><input type='radio' name='partRadioBtn' value='0'>reviewer</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'checked='checked'>reviewee</label>";
        }
        html += "</div>";
        html += "<div onclick='obj=document.getElementById(\"commit-history\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
        html += "<a class='item2' style='cursor:pointer;'>▼show commit messages</a>";
        html += "</div>";
        html += "<div id='commit-history'>";


        for (var i = 0; i < manager.commitMessages.length; i++) {
            html += `<div class="commit-history-outer">ver.${i}:<div class="commit-history-inner">${manager.commitMessages[i].replace(/\n|\r|\r\n/g, "<br/>")}</div></div>`;
        }
        html += "</div>";

        return html;
    }

    public static getSummaryAsHtmlInJpn(manager :ReviewPointManager) {
        let html: string = "";
        html += "<span class='item2'>現在のバージョン: </span>" + manager.version + "<br/>";
        html += "<div><span class='item2'>現在の担当: </span>";
        if (manager.part[manager.version] === ReviewPointManager.REVIEWER) {
            html += "<label><input type='radio' name='partRadioBtn' value='0' checked='checked'>指摘者</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'>コーダ</label>";
        }
        else {
            html += "<label><input type='radio' name='partRadioBtn' value='0'>指摘者</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'checked='checked'>コーダ</label>";
        }
        html += "</div>";
        html += "<div onclick='obj=document.getElementById(\"commit-history\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
        html += "<a class='item2' style='cursor:pointer;'>▼コミットメッセージを表示</a>";
        html += "</div>";
        html += "<div id='commit-history'>";


        for (var i = 0; i < manager.commitMessages.length; i++) {
            html += `<div class="commit-history-outer">ver.${i}:<div class="commit-history-inner">${manager.commitMessages[i].replace(/\n|\r|\r\n/g, "<br/>")}</div></div>`;
        }
        html += "</div>";

        return html;
    }
}

class ReviewJsonConverter{
    public static getAsJSON(manager :ReviewPointManager) {
        let json: string = "";

        json += JSON.stringify({
            history: manager.history,
            commitMessages: manager.commitMessages,
            version: manager.version,
            part: manager.part,
            rp_list: manager.rp_list
        });

        return json;
    }

    public static loadFromJSON(json: string, manager :ReviewPointManager) {

        try {
            let j = JSON.parse(json);

            manager.history = j.history;
            manager.commitMessages = (j.commitMessages)?j.commitMessages : [];
            manager.version = j.version;
            manager.part = j.part;

            manager.rp_list = [];

            j.rp_list.forEach((element: any) => {
                let rp = RpJsonConverter.createFromJsonObj(element);
                manager.rp_list.push(rp);
            });
            return true;
        } catch (e) {
            return false;
        }
    }
}