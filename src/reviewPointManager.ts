'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type KeyValuePair = {key :string, value :any};

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

    public add_time :Date | undefined= undefined; // should be set once when added this rp
    public done_time :Date | undefined = undefined; // should be updated when committed as reviewee

    setAddTime() {
        if(this.add_time === undefined) { this.add_time =  new Date(Date.now());}
    }

    updateDoneTime() {
        this.done_time =  new Date(Date.now());
    }

    getAddTime() {
        return this.add_time;
    }

    getDoneTime() {
        return this.done_time;
    }

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

    private getUserName() :string
    {
        let username = vscode.workspace.getConfiguration("review", null).get<string>("username");
        
        if(username === "") {
            const os = require("os");
            username = os.userInfo().username;
        }

        if(!username) {
            username = "undefined";
        }

        return username;
    }


    public revert() :boolean{
        if(this.history.length !== 0) {
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

        obj.options.forEach((opt:any) => {
            rp.options.push({key: opt.key, value: opt.value});
        });

         if(obj.add_time) {
             rp.add_time = obj.add_time;
         }

         if(obj.done_time) {
             rp.done_time = obj.done_time;
         }

        return rp;
    }

    public getAsHtml(context :vscode.ExtensionContext)
    {
        let html: string = "";

        if(this.isClosed === true) {
            html += "<tr><td><div class='rp_frame rp_closed'>";
        }
        else {
            html += "<tr><td><div class='rp_frame'>";
        }
        html += "<div class='btn-container'>";
        // octicon:https://octicons.github.com/
        // below svg is hard copy of 'x.svg' of octicon.
        html += `<div title="Delete this review point."><svg class='remove x' id='rmv.${this.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z'/></svg></div>`;
        // below svg is hard copy of 'check.svg' of octicon.
        html += `<div title="Close this review point."><svg class='close check' id='cls.${this.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M12 5l-8 8-4-4 1.5-1.5L4 10l6.5-6.5L12 5z'/></svg></div>`;
        // below svg is hard copy of 'sync.svg' of octicon.
        html += `<div title="Update range of this review point with current selection."><svg class='revice sync tooltip' id='rev.${this.id}' xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'><path fill-rule='evenodd' d='M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z'/></svg></div>`;
        html += "</div>";
        html += "<div id=" + this.id + " class='rp'>";
        html += "<span class='item2'>file: </span>" + this.file + "<br/>";
        html += "<span class='item2'>range: </span>(" + this.range.start.line.toString() + ", ";
        html += this.range.start.character.toString() + ") to (" + this.range.end.line.toString() + ", " + this.range.end.character.toString() + ")";
        html += "<br/>";
        html += "</div>";
        
        html += "<div onclick='obj=document.getElementById(\"optional." + this.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
        html += "<a class='item2' style='cursor:pointer;'>▼show optional info</a>";
        html += "</div>";
        html += "<div id='optional." + this.id + "' class='optional'>";
        html += this.getOptionsAsHtml(context);
        html += "</div>";
        
        if(this.isClosed === true) {
            html += "<div onclick='obj=document.getElementById(\"comments." + this.id + "\").style; obj.display=(obj.display==\"none\")?\"block\":\"none\";'>";
            html += "<a class='item2' style='cursor:pointer;'>▼show comments</a>";
            html += "</div>";
            html += "<div id='comments." + this.id + "' class='closedComments'>";
        }
        this.history.forEach(e => {
            html += "<span class='item2 ver" + e.version + "'>history(ver." + e.version + ") by " + e.author + ": </span><br/>";
            html += "<div class='history'>" + e.comment + "</div>";
        });
        if(this.isClosed !== true) {
            html += "<span class='item2 ver" + this.version + "'>comment(ver." + this.version + ") by " +  this.author + ": </span><br/>";
            html += "<div class='comment' id='cmt." + this.id + "'>" + this.comment + "</div>";
        }else {
            html += "</div>";
            html += "<span class='item2'>this review point was closed at ver." + this.version + " by " + this.author +  "</span><br/>";
        }

        html += "</div></td></tr>";

        return html;
    }


    public initializeOption(context :vscode.ExtensionContext)
    {
        try{

            let optionformat = this.loadOptionsAsArrayObject(context);
            optionformat.forEach((element :any) => {
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

                html += "<span style='width: 200px; display: inline-block;'>" + element.name + ": </span>";
                html += "<div style='width: 200px; display: inline-block;'>";
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

                // parse enableWhen setting and add corresponding js code to html
                if("enableWhen" in element) {
                    html += "<script>";
                    html += "document.getElementById('"  + this.id + "." + element.id + "').disabled = true;";
                    element.enableWhen.caseValues.forEach((it : any) => {
                        html += "if(document.getElementById('" + this.id + "." +  element.enableWhen.target + "').options[document.getElementById('" + this.id + "." +  element.enableWhen.target + "').selectedIndex].value === '" + it + "'){ document.getElementById('"  + this.id + "." + element.id + "').disabled = false; }";
                    });
                    html += "if(document.getElementById('"  + this.id + "." + element.id + "').disabled === true){";
                    html += "document.getElementById('"  + this.id + "." + element.id + "').selectedIndex = 0;";
                        html += "vscode.postMessage({";
                        html += "command: 'opt_list',";
                        html += "id: '" + this.id + "." + element.id +"',";
                        html += "value: 0";
                        html += "});";
                    html += "}";                    
                    html += "document.getElementById('" + this.id + "." +  element.enableWhen.target + "').addEventListener('change', function() {";
                        html += "document.getElementById('"  + this.id + "." + element.id + "').disabled = true;";
                        element.enableWhen.caseValues.forEach((it : any) => {
                            html += "if(this.options[this.selectedIndex].value === '" + it + "'){ document.getElementById('"  + this.id + "." + element.id + "').disabled = false; }";
                        });
                        html += "if(document.getElementById('"  + this.id + "." + element.id + "').disabled === true){";
                            html += "document.getElementById('"  + this.id + "." + element.id + "').selectedIndex = 0;";
                            html += "vscode.postMessage({";
                                html += "command: 'opt_list',";
                                html += "id: '" + this.id + "." + element.id +"',";
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

    public static REVIEWER = 0;
    public static REVIEWEE = 1;

    private part: number[] = [ReviewPointManager.REVIEWER];

    constructor() {
        this.importIfExist();
    }

    public commit(save_path: string) {
        // save this version's workspace folder path
        this.history.push(vscode.workspace.workspaceFolders![0].uri.fsPath);
        this.part.push(this.getOppositePart()); // you should do this before updating version!
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
        this.part.pop();
        this.history.pop();

        let remove_id_list :string[]= [];
        this.rp_list.forEach(element => {
            if(element.isClosed === true) {
                if(element.version === this.version) {
                    if(element.history.length === 0) {
                        // remove element itself because history is now empty.
                        // !NOTICE: Do not remove element here because current outer Foreach gonna be broken!
                        remove_id_list.push(element.id);
                    }
                    else {
                        element.revert()
                    }
                }
            }
            else {
                if(element.history.length === 0) {
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
            this.rp_list.splice(this.rp_list.findIndex(it => {return it.id === element;})  ,1);
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
                if(this.part[this.version] === ReviewPointManager.REVIEWEE){ rp.updateDoneTime(); }
            }
        }
    }

    public add(file: string, range: vscode.Range, context :vscode.ExtensionContext) {
        let rp = new ReviewPoint(this.version, file, range);
        rp.initializeOption(context);
        rp.setAddTime();
        this.rp_list.push(rp);
    }

    public close(cls_id :string) {
        let rp = this.findById(cls_id.replace("cls.", ""));

        if(rp!.isClosed === false) {
            rp!.isClosed = true;
        }
        else
        {
            if(rp!.version === this.version) {
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

    public getSummaryAsHtml()
    {
        let html: string = "";
        html += "<span class='item2'>current version: </span>" + this.version + "<br/>";
        html += "<div><span class='item2'>current part: </span>";
        if(this.part[this.version] === ReviewPointManager.REVIEWER) {
            html += "<label><input type='radio' name='partRadioBtn' value='0' checked='checked'>reviewer</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'>reviewee</label>";
        }
        else {
            html += "<label><input type='radio' name='partRadioBtn' value='0'>reviewer</label>";
            html += "<label><input type='radio' name='partRadioBtn' value='0'checked='checked'>reviewee</label>";
        }

        html += "</div>";
        return html;
    }

    public getAsHtml(context :vscode.ExtensionContext, refineBy?:string, sortBy?:string, value?: string) {
        let html: string = "";
        let list = undefined;

        if(refineBy === "unclosed") {
            list = this.rp_list.filter((value)=>{
                return value.isClosed === false;
            });
        }
        else if(refineBy === "closed") {
            list = this.rp_list.filter((value)=>{
                return value.isClosed === true;
            });
        }
        else if(refineBy === "refine.file") {
            list = this.rp_list.filter((val)=>{
                return val.file.includes(value!);
            });
        }
        else if(sortBy === "file") {
            list = this.rp_list.slice().sort((a, b)=> {
                if(a.file !== b.file) {
                    return (a.file < b.file)?-1:1;
                }
                else 
                {
                    return (a.range.start.isBefore(b.range.start))?-1:1;
                }
            });
        }
        else if(sortBy === "version") {
            list = this.rp_list.slice().sort((a, b)=> {
                let ver_a, ver_b;

                ver_a = (a.history === [])?a.version:a.history[0].version;
                ver_b = (a.history === [])?b.version:b.history[0].version;
                
                return ver_a - ver_b;
            });
        }
        else {
            list = this.rp_list;
        }

        list!.forEach(element => {
            html += element.getAsHtml(context);
        });

        // distinguish between reviewer and reviewee
        html += "<style>";
        for(var i = 0; i <= this.version; i++){
            html += ".ver" + i + "{";
            if(this.part[i] === ReviewPointManager.REVIEWER) {
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
            part: this.part,
            rp_list: this.rp_list
        });

        return json;
    }

    public loadFromJSON(json: string) {

        try {
            let j = JSON.parse(json);

            this.history = j.history;
            this.version = j.version;
            this.part    = j.part;

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

    public switchCurrentPart() {
        this.part[this.version] = this.getOppositePart();
    }

    getOppositePart() {
        if(this.part[this.version] === ReviewPointManager.REVIEWEE) {
            return ReviewPointManager.REVIEWER;
        }
        else {
            return ReviewPointManager.REVIEWEE;
        }
    }
}