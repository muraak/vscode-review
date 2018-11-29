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
                let range_new =  this.getNewRange(element, range, text);
                // getNewRange() returns `undefined` if this review point is not necessary to update
                if(range_new) {
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

    private getNewRange(rp :ReviewPoint, range_chenged :vscode.Range, text_changed :string)
    {
        let range_new :vscode.Range | undefined = undefined;

        if (range_chenged.start.isBeforeOrEqual(rp.range.start) === true) {
            if(rp.range.start.line !== range_chenged.end.line) {
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

                if(diff_of_lines > 0) {
                    // some lines were added
                    range_new = new vscode.Range(
                        new vscode.Position(rp.range.start.line + diff_of_lines, range_chenged.end.character),
                        new vscode.Position(rp.range.end.line + diff_of_lines, rp.range.end.character + range_chenged.end.character)
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
        else if(range_chenged.intersection(rp.range)) {
            // there is overlap between range_changed and rp.range
            if(rp.range.end.line > range_chenged.end.line) {
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

                if(diff_of_lines > 0) {
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
}