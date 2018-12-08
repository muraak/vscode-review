'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type KeyValuePair = {key :string, value :any}

export class ReviewPoint {
    public file: string;
    public range: vscode.Range;
    public comment: string;
    readonly id: string;
    public history: ReviewPoint[] = [];
    public version: number;
    public isClosed: boolean;
    public author :string;
    public options :KeyValuePair[] = [];

    constructor(
        version :number, 
        file :string, 
        range :vscode.Range, 
        comment? :string,
        id? :string,
        isClosed? :boolean,
        author? :string) {
        
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

        if(!isClosed) {
            this.isClosed = false;
        }
        else {
            this.isClosed = isClosed;
        }

        if(!author) {
            const os = require("os");
            this.author = os.userInfo().username;
        }
        else {
            this.author = author;
        }
    }

    public commit(current_version: number) {
        this.history.push(this.deepcopy());
        this.reflesh(current_version);
    }


    public revert() {
        let prev_rp = this.history.pop();
        this.version = prev_rp!.version;
        this.file = prev_rp!.file;
        this.range = new vscode.Range(
            new vscode.Position(prev_rp!.range.start.line, prev_rp!.range.start.character),
            new vscode.Position(prev_rp!.range.end.line, prev_rp!.range.end.character));
        this.comment = prev_rp!.comment;
        this.isClosed = prev_rp!.isClosed;
        this.author = prev_rp!.author;
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
            undefined,
            this.author);
    }

    public static createFromJsonObj(obj: any) {
        let rp = new ReviewPoint(
            obj.version,
            obj.file,
            new vscode.Range(
                new vscode.Position(obj.range[0].line, obj.range[0].character),
                new vscode.Position(obj.range[1].line, obj.range[1].character)),
            obj.comment,
            obj.id,
            undefined,
            (obj.hasOwnProperty("author"))?obj.author:undefined);

        obj.history.forEach((h: any) => {
            rp.history.push(
                new ReviewPoint(h.version, h.file,
                    new vscode.Range(
                        new vscode.Position(h.range[0].line, h.range[0].character),
                        new vscode.Position(h.range[1].line, h.range[1].character)), h.comment, h.id));
        });

        obj.options.forEach((opt:any) => {
            rp.options.push({key: opt.key, value: opt.value});
        });

        return rp;
    }

    public getAsHtml(context :vscode.ExtensionContext)
    {
        let html: string = "";

        html += "<tr><td><div class='rp_frame'>";
        html += "<div id=" + this.id + " class='rp'>";
        html += "<span class='item2'>file: </span>" + this.file + "<br/>";
        html += "<span class='item2'>range: </span>(" + this.range.start.line.toString() + ", ";
        html += this.range.start.character.toString() + ") to (" + this.range.end.line.toString() + ", " + this.range.end.character.toString() + ")";
        html += "<br/>";
        html += "</div>";
        
        html += "<span class='item2'>optional information:</span><br/>";
        html += "<div class='optional' style='margin-left: 30px;'>";
        html += this.getOptionsAsHtml(context);
        html += "</div>";
        
        this.history.forEach(e => {
            html += "<span class='item2'>history(ver." + e.version + ") by " + e.author + ": </span><br/>";
            html += "<div class='history' style='margin-left: 30px; width: 70vw;'>" + e.comment + "</div>";
        });
        if(this.isClosed !== true) {
            html += "<span class='item2'>comment(ver." + this.version + ") by " +  this.author + ": </span><br/>";
            html += "<div class='comment' style='margin-left: 30px; width: 70vw;' id='cmt." + this.id + "'>" + this.comment + "</div>";
        }else {
            html += "<br/><span class='item2'>this review point was closed at ver." + this.version + " by " + this.author +  "</span><br/>";
        }
        html += "<button class='close' id='cls." + this.id + "'>close</button>";
        html += "<button class='remove' id='rmv." + this.id + "'>remove</button>";
        html += "<button class='revice' id='rev." + this.id + "'>revice range</button>";

        html += "</div></td></tr>";

        return html;
    }

    public initializeOption(context :vscode.ExtensionContext)
    {
        try{

            let format = this.loadOptionsAsArrayObject(context);
            format.forEach((element :any) => {
                this.options.push({
                    key: element!.id,
                    value: element!.defaultValue});
            });
        }
        catch(e){
            vscode.window.showErrorMessage("parsing of optionalFormat.json was failed.\n" + e.message);
        }
    }

    public getOptionsAsHtml(context :vscode.ExtensionContext) {
        
        let html: string = "<div>";

        let format = this.loadOptionsAsArrayObject(context);

        format.forEach((element :any) => {
            
            // get current option's value
            let value :any; 
            
            try {
                value = this.options.find(x => {return x.key === element.id;})!.value;
            }
            catch
            {
                value = element.defaultValue;
            }

            if(element.type === 0) {
                // this option is gonna be a checkbox

                if(value === true){
                    html += "<input type='checkbox' id='" + this.id + "." + element.id + "' checked='checked' class='opt_chkbox'>" + element.name + "</input><br/>";
                }
                else {
                    html += "<input type='checkbox' id='" + this.id + "." + element.id + "' class='opt_chkbox'>" + element.name + "</input><br/>";
                }
            }
            else if(element.type === 1) {
                // this option is gonna be a drop-down list

                html += "<span>" + element.name + ": </span>";
                html += "<div style='width: 150px; display: inline-block;'>";
                html += "<select class='opt_list cp_ipselect cp_sl01' id='" + this.id + "." + element.id + "'>";

                element.listValues.forEach((elm :any)=> {
                    if(elm.value === value){
                        html += "<option value=" + elm.value + " selected>" + elm.name + "</option>";
                    }
                    else {
                        html += "<option value=" + elm.value + ">" + elm.name + "</option>";
                    }
                });

                html += "</select></div><br/>";

                if("enableWhen" in element) {
                    html += "<script>";
                    html += "document.getElementById('" + this.id + "." +  element.enableWhen.target + "').addEventListener('change', function() {";
                    html += "document.getElementById('"  + this.id + "." + element.id + "').disabled = true;";
                    element.enableWhen.caseValues.forEach((it : any) => {
                        html += "if(this.options[this.selectedIndex].value === '" + it + "'){ document.getElementById('"  + this.id + "." + element.id + "').disabled = false;}";
                    });
                    html += "if(document.getElementById('"  + this.id + "." + element.id + "').disabled === true){document.getElementById('"  + this.id + "." + element.id + "').selectedIndex = 0;}";
                    html += "document.getElementById('"  + this.id + "." + element.id + "').onchange();";
                    html += "});";
                    html += "</script>";
                }
            }
        });

        html += "</div>";

        return html;
    }

    private loadOptionsAsArrayObject(context :vscode.ExtensionContext)
    {
        return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "configuration", "optionalFormat.json")).toString());
    }

    public updateOption(key :string, value :any) {
        let tgt = this.options[this.options.findIndex(x => {return x.key === key;})];

        if(tgt) {
            tgt.key = key;
            tgt.value = value;
        }
    }
}

export class ReviewPointManager {

    private rp_list: ReviewPoint[] = [];

    private history: string[] = [];

    private version: number = 0;

    constructor() {
        this.importIfExist();
    }

    public commit(save_path: string) {
        // save this version's workspace folder path
        this.history.push(vscode.workspace.workspaceFolders![0].uri.fsPath);
        this.version++;
        this.rp_list.forEach(element => {
            if(element.isClosed === false) {
                element.commit(this.version);
            }
        });

        this.export(save_path);
    }

    public revert(save_path: string) {
        if(this.version < 1) {
            return;
        }
        this.history.pop();
        this.rp_list.forEach(element => {
            if(element.isClosed === true) {
                if(element.version === this.version) {
                    element.revert();
                }
            }
            else {
                element.revert();
            }
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
            if(exists === true) {
                fs.writeFile(path.join(save_path, '.vscode', 'vscode-review.json'), this.getAsJSON(), (err) => {
                    
                    if(err) {
                        vscode.window.showErrorMessage(err.message);
                    }
                });
            }
            else {
                fs.mkdir(save_dir, (err) => {
                    if(err) {
                        vscode.window.showErrorMessage(err.message);
                    }
                    else {
                        fs.writeFile(path.join(save_path, '.vscode', 'vscode-review.json'), this.getAsJSON(), (err) => {                   
                            if(err) {
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
            if (this.loadFromJSON(json) === true) {
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
            }
        }
    }

    public add(file: string, range: vscode.Range, context :vscode.ExtensionContext) {
        let rp = new ReviewPoint(this.version, file, range);
        rp.initializeOption(context);
        this.rp_list.push(rp);
    }

    public close(cls_id :string) {
        this.findById(cls_id.replace("cls.", ""))!.isClosed = true;
    }

    public remove(rmv_id: string) {
        let tgt = this.findById(rmv_id.replace("rmv.", ""));

        if (tgt) {
            this.rp_list.splice(this.rp_list.indexOf(tgt), 1);
        }
    }

    public getSummaryAsHtml()
    {
        let html: string = "";
        html += "<span class='item2'>current version: </span>" + this.version + "<br/>";
        // this.history.forEach(h => {
        //     html += "<div style='margin-left: 30px;'>" + h + "</div>";
        // });
        // html += "<br/>";
        return html;
    }

    public getAsHtml(context :vscode.ExtensionContext) {
        let html: string = "";

        this.rp_list.forEach(element => {
            html += element.getAsHtml(context);
        });

        return html;
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

    public getAsJSON() {
        let json: string = "";

        json += JSON.stringify({
            history: this.history,
            version: this.version,
            rp_list: this.rp_list
        });

        return json;
    }

    public loadFromJSON(json: string) {

        try {
            let j = JSON.parse(json);

            this.history = j.history;
            this.version = j.version;

            this.rp_list = [];

            j.rp_list.forEach((element: any) => {
                let rp = ReviewPoint.createFromJsonObj(element);
                this.rp_list.push(rp);
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    public updateOption(id :string, value :any)
    {
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
}