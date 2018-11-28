'use strict';

import * as vscode from 'vscode';

export class ReviewPoint {
    public file: string;
    public range: vscode.Range;
    public comment: string;
    readonly id: string;

    constructor(file: string, range: vscode.Range) {
        this.file = file;
        this.range = range;
        const shortid = require('shortid');
        this.id = shortid.generate();
        this.comment = "add comment here.";
    }

    public needToUpdate(range: vscode.Range, text: string) {
        if (this.isBefore(range) == true) {
            if (this.isAddedNewLine(text) == true) {
                return true;
            }
        }

        if (this.isOverlapped(range) == true) {
            return true;
        }

        return false;
    }

    private isOverlapped(range_chenged: vscode.Range) {
        return false;
    }

    private isBefore(range_chenged: vscode.Range) {
        return range_chenged.end.line < this.range.start.line;
    }

    private isAddedNewLine(text: string) {
        return false;
    }
}

export class ReviewPointManager {

    private rp_list: ReviewPoint[] = [];

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
        this.rp_list.push(new ReviewPoint(file, range));
    }

    public remove(rmv_id: string) {
        let tgt = this.findById(rmv_id.replace("rmv.", ""));

        if (tgt) {
            this.rp_list.splice(this.rp_list.indexOf(tgt), 1);
        }
    }

    public getAsHtml() {
        let html: string = "";

        this.rp_list.forEach(element => {
            html += "<tr><td>";
            html += "<div id=" + element.id + " class='rp'>";
            html += "file: " + element.file + "<br/>";
            html += "position: (" + element.range.start.line.toString() + ", ";
            html += element.range.start.character.toString() + ")<br/>";
            html += "</div>";
            html += "comment: <br/>";
            html += "<div class='comment' style='margin-left: 30px;' id='cmt." + element.id + "'>" + element.comment + "</div>";
            html += "<button class='remove' id='rmv." + element.id + "'>remove</button>";
            html += "<button class='reply' id='rly." + element.id + "'>reply</button>";
            html += "</td></tr>";
        });

        return html;
    }

    public belongsTo(file: string) {

        let idx = this.rp_list.findIndex(x => { return (x.file === file); })

        return idx >= 0;
    }

    public updateRanges(file: string, range: vscode.Range, text: string, document :vscode.TextDocument) {

        let updated = false;

        this.rp_list.forEach(element => {
            if (element.file === file) {
                if (range.end.isBeforeOrEqual(element.range.start)) {
                    let lines_changed = this.calcNumOfLines(range, text);
                    if (lines_changed !== 0) {
                        if (lines_changed > 0) {
                            this.findById(element.id)!.range = new vscode.Range(
                                new vscode.Position(
                                    element.range.start.line + lines_changed, 
                                    text.split(/\r?\n/).pop()!.length/* + element.range.start.character*/),
                                new vscode.Position(
                                    element.range.end.line + lines_changed, 
                                    element.range.end.character)
                            );
                        }
                        else {
                            this.findById(element.id)!.range = new vscode.Range(
                                new vscode.Position(
                                    element.range.start.line + lines_changed,
                                    element.range.start.character + range.start.character),
                                new vscode.Position(element.range.end.line + lines_changed, 
                                    (element.range.start.line === element.range.end.line)?
                                    element.range.end.character + range.start.character:element.range.end.character));
                        }

                        updated = true;
                    }
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
}