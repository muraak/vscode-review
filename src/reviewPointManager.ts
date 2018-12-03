'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ReviewPoint {
    public file: string;
    public range: vscode.Range;
    public comment: string;
    readonly id: string;
    public history: ReviewPoint[] = [];
    public version: number;
    public isClosed: boolean;

    constructor(
        version :number, 
        file :string, 
        range :vscode.Range, 
        comment? :string,
        id? :string,
        isClosed? :boolean) {
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
    }

    public save(current_version: number) {
        this.history.push(this.deepcopy());
        this.reflesh(current_version);
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
            this.id);
    }

    public static createFromJsonObj(obj: any) {
        let rp = new ReviewPoint(
            obj.version,
            obj.file,
            new vscode.Range(
                new vscode.Position(obj.range[0].line, obj.range[0].character),
                new vscode.Position(obj.range[1].line, obj.range[1].character)),
            obj.comment,
            obj.id);

        obj.history.forEach((h: any) => {
            rp.history.push(
                new ReviewPoint(h.version, h.file,
                    new vscode.Range(
                        new vscode.Position(h.range[0].line, h.range[0].character),
                        new vscode.Position(h.range[1].line, h.range[1].character)), h.comment, h.id));
        });

        return rp;
    }

    public getAsHtml()
    {
        let html: string = "";

        html += "<tr><td>";
        html += "<div id=" + this.id + " class='rp'>";
        html += "file: " + this.file + "<br/>";
        html += "range: (" + this.range.start.line.toString() + ", ";
        html += this.range.start.character.toString() + ") to (" + this.range.end.line.toString() + ", " + this.range.end.character.toString() + ")";
        html += "<br/>";
        html += "</div>";

        this.history.forEach(e => {
            html += "history(ver." + e.version + "): <br/>";
            html += "<div class='history' style='margin-left: 30px;'>" + e.comment + "</div>";
        });
        if(this.isClosed !== true) {
            html += "comment(ver." + this.version + "): <br/>";
            html += "<div class='comment' style='margin-left: 30px;' id='cmt." + this.id + "'>" + this.comment + "</div>";
        }else {
            html += "<br/>this review point was closed at ver." + this.version + "<br/>";
        }
        html += "<button class='close' id='cls." + this.id + "'>close</button>";
        html += "<button class='remove' id='rmv." + this.id + "'>remove</button>";
        html += "<button class='revice' id='rev." + this.id + "'>revice range</button>";

        html += "</td></tr>";

        return html;
    }
}

export class ReviewPointManager {

    private rp_list: ReviewPoint[] = [];

    private history: string[] = [];

    private version: number = 0;

    constructor() {
        this.importIfExist();
    }

    public save(save_path: string) {
        // save this version's workspace folder path
        this.history.push(vscode.workspace.workspaceFolders![0].uri.fsPath);
        this.version++;
        this.rp_list.forEach(element => {
            if(element.isClosed === false) {
                element.save(this.version);
            }
        });

        this.export(save_path);
    }

    private export(save_path: string) {
        fs.writeFile(path.join(save_path, '.vscode', 'vscode-review.json'), this.getAsJSON(), (err) => {
            vscode.window.showErrorMessage(err.message);
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

    public add(file: string, range: vscode.Range) {
        this.rp_list.push(new ReviewPoint(this.version, file, range));
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
        html += "<br/>current version: " + this.version + "<br/>";
        this.history.forEach(h => {
            html += "<div style='margin-left: 30px;'>" + h + "</div>";
        });
        html += "<br/>";
        return html;
    }

    public getAsHtml() {
        let html: string = "";

        this.rp_list.forEach(element => {
            html += element.getAsHtml();
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

        tgt!.range = editor.selection;

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
}