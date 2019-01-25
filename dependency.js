import {minScaleRatio, maxScaleRatio, drawTokens, getSizesById, getBBoxSafely, escapeLatexChars} from './Common';
import {select} from 'd3-selection';
import {scaleLinear, scaleLog, scalePow} from 'd3-scale';

const arcElements = ["arrow_", "arc_", "label_"];

// Takes the d3 data for a sentence and returns tikz code as string (taken from old Danny's TüNDRA)
export function d3ToTikz(d3Input) {
    if ((d3Input.sentence) && (d3Input.links)) {
        // shortcuts to some html whitespace. should update to css...
        let fourspace = "    ";
        let eightspace = "        ";

        // prefactory warnings for languages like tamil
        let preamble = "% Note: this environment is designed for roman alphabet languages, and requires\n" +
                "% LaTeX and the \\usepackage{tikz-dependency} in your preamble. If you want to\n" +
                "% work with other scripts, you may need to install additional fonts\n" +
                "% and use XeTeX for compliation. If you notice any errors in the way that trees\n" +
                "% are displayed, or want a new feature added, please file an issue request, or\n" +
                "% consult https://mirror.hmc.edu/ctan/graphics/pgf/contrib/tikz-dependency/tikz-dependency-doc.pdf\n\n";

        // rowformat may or may not get filled with info about textsc etc
        let rowformat = "";
        let s = "\\begin{dependency}\n" +
        fourspace + "\\begin{deptext}[column sep=.7cm, row sep=.1ex]\n"

        let lemmaline = eightspace;
        let posline = eightspace;
        let tokensline = eightspace;
        let categories = d3Input.table[0].categories;

        for (let i = -1; i < d3Input.table.length; i++) {
            if (i == -1) {
                // tokensline += "\\underline{\\footnotesize{\\textsc{Token}}} \\& ";
                // if ("lemma" in categories) {
                //     lemmaline += "\\underline{\\footnotesize{\\textsc{Lemma}}} \\& ";
                // }
                // if ("pos" in categories) {
                //     posline += "\\underline{\\footnotesize{\\textsc{POS}}} \\& ";
                // }
                continue
            }

            categories = d3Input.table[i].categories;

            if ("text" in categories)  {
                tokensline += escapeLatexChars(d3Input.table[i].token);
            } else {
                tokensline += "~";
            }
            if ("lemma" in categories) {
                lemmaline += escapeLatexChars(categories.lemma);

                if (i+1 == d3Input.tokens.length) {
                    rowformat += "\\resizebox{\\linewidth}{!}{\n\\usetikzlibrary{matrix}\n" +
                    fourspace + "\\tikzset{row 2/.style={nodes={font=\\it}}}\n"
                }
            } else {
                lemmaline += "~";
            }
            if ("pos" in categories) {
                posline += escapeLatexChars(categories.pos);

                if (i+1 == d3Input.tokens.length) {
                    rowformat += fourspace + "\\tikzset{row 3/.style={nodes={font=\\ttfamily}}}\n"
                }
            } else {
                posline += "~";
            }
            if (i+1 !== d3Input.tokens.length) {
                tokensline += "  \\&  "
                lemmaline += "  \\&  "
                posline += "  \\&  "
            } else {
                tokensline += " \\\\\n";
                lemmaline += " \\\\\n";
                posline += " \\\\\n";
            }
        }

        if (!tokensline.length == 0) {
            s += tokensline;
        }
        if (!lemmaline.length == 0) {
            s += lemmaline;
        }
        if (!posline.length == 0) {
            s += posline;
        }
        s = s + fourspace + "\\end{deptext}\n";
        for (let i = 0; i < d3Input.links.length; i++) {
            let link = d3Input.links[i];
            let rel = link.dependency;
            let formed = link.id.split("_");
            if (formed[0] == "nr") {
                s = s + fourspace + "\\deproot{" + (Number.parseInt(formed[2], 10)+1) + "}{" + rel + "}\n"
            } else {
                s = s + fourspace + "\\depedge{" + (Number.parseInt(formed[1],10)+1) + "}{" + (Number.parseInt(formed[3], 10)+1) + "}{" + rel + "}\n"
            }
        }
        s = preamble + rowformat + s + "\\end{dependency}\n}\n";
        return s;
    } else {
        return null;
    }
}

function fillRange(start, end) {
    return new Set(Array(end - start + 1).fill().map((item, index) => start + index));
}

function sSubset(smallSet, largeSet) {
    const diffSet = new Set([...smallSet].filter(x => !largeSet.has(x)));
    if (diffSet.size == 0) {
        return true
    } else {
        return false
    }
}

function switchElementClass(elementId, oldClass, newClass) {
    select("#" + elementId)
      .classed(oldClass, false);
    select("#" + elementId)
      .classed(newClass, true);
}

function selectToken(tokenId, input) {
    if (input.links.length>0) {
        let nameList = tokenId.split("_");
        if (nameList.length>1) {
            let startPosition = nameList[1];
            for (let i = 0; i < input.links.length; i++) {
                if (input.links[i].source == startPosition) {
                    selectArc(input.links[i].id);
                    switchElementClass("node_"+input.links[i].target, "svg-token-normal", "svg-token-selected");
                }
            }
        }
    }
    switchElementClass(tokenId, "svg-token-normal", "svg-token-selected");
}

function unselectToken(tokenId, input) {
    if (input.links.length>0) {
        for (let i = 0; i < input.links.length; i++) {
            unselectArc(input.links[i].id);
            switchElementClass("node_"+input.links[i].target, "svg-token-selected", "svg-token-normal");
        }
    }
    switchElementClass(tokenId, "svg-token-selected", "svg-token-normal");
}

function selectArc(arcId) {
    switchElementClass(arcElements[0]+arcId, "svg-path-normal", "svg-path-selected");
    switchElementClass(arcElements[1]+arcId, "svg-path-normal", "svg-path-selected");
    switchElementClass(arcElements[2]+arcId, "svg-label-normal", "svg-box-selected");
}

function unselectArc(arcId) {
    switchElementClass(arcElements[0]+arcId, "svg-path-selected", "svg-path-normal");
    switchElementClass(arcElements[1]+arcId, "svg-path-selected", "svg-path-normal");
    switchElementClass(arcElements[2]+arcId, "svg-box-selected", "svg-label-normal");
}


export function createDependencyTree(sizes, queryMatch, table, queryRelations) {
    const arcRadiusX = 20;
    const node = this.node;

    select(node)
      .selectAll("g")
      .remove()

    // Node for zooming and panning
    select(node)
        .append("g")
        .attr("id", "image");

    // Node that will be scaled
    select("#image")
        .append("g")
        .attr("id", "canvas");

    // Node responsible for the correct offsets and centering when the images is ready
    select("#canvas")
        .append("g")
        .attr("id", "movable");

    select("#movable")
        .append("g")
        .attr("id", "tokens");

    let treeNodes = this.props.input.nodes;
    let treeArcs = this.props.input.links;
    let scaleRatio = 1;
    let arcExtraRadiusX = 0;
    let tokenDrawingResults = drawTokens({tokens: treeNodes, queryMatch: queryMatch, links: treeArcs, table: table}, selectToken, unselectToken);

    let tokenOffsetLeft = tokenDrawingResults.tokenOffsetLeft;
    let tokenCenter = tokenDrawingResults.tokenCenter;
    let tokenHeight = tokenDrawingResults.tokenHeight;

    if (sizes.width!=tokenOffsetLeft) {
        if (tokenOffsetLeft != 0) {
            scaleRatio = sizes.width/tokenOffsetLeft;
            scaleRatio = Math.max(minScaleRatio, Math.min(scaleRatio, maxScaleRatio));
        }
    }

    select("#movable")
        .append("g")
        .attr("id", "arcs");

    const arcScale = scalePow()
        .exponent(0.5)
        .domain([0, treeArcs.length])
        .range([0, arcRadiusX]);

    let depDistances = [];
    for (let i = 0; i < treeArcs.length; i++) {
        depDistances.push(Math.abs(treeArcs[i].source-treeArcs[i].target));
    }

    let sortedDepDistances = depDistances.slice();
    sortedDepDistances.sort(function(a, b){return b - a});

    let arcsToShorten = [];
    // for (let i = 0; i < sortedDepDistances.length; i++) {
    //     if (i>0) {
    //         if ((sortedDepDistances[i-1]-sortedDepDistances[i])>1) {
    //             arcsToShorten.push(sortedDepDistances[i-1]);
    //         }
    //     }
    // }
    let depCount = treeArcs.length;
    // if (depCount>1) {
    //     if ((sortedDepDistances[0]-sortedDepDistances[1])>1) {
    //         arcsToShorten.push(sortedDepDistances[0]);
    //     }
    // }
    let svgPathClass = "svg-path-normal";
    let svgLabelClass = "svg-label-normal";

    for (let i = 0; i < treeArcs.length; i++) {
        let pathSource = tokenCenter[treeArcs[i].source];
        let pathTarget = tokenCenter[treeArcs[i].target];
        let sourceOffset = 3;
        let targetOffset = 0;
        svgPathClass = "svg-path-normal";
        svgLabelClass = "svg-label-normal";

        if (pathSource > pathTarget) {
            pathSource = tokenCenter[treeArcs[i].target];
            pathTarget = tokenCenter[treeArcs[i].source];
            sourceOffset = 0;
            targetOffset = -3;
        }

        if (pathSource != pathTarget) {
            if (arcsToShorten.indexOf(Math.abs(treeArcs[i].source-treeArcs[i].target))>-1) {
                arcExtraRadiusX = arcScale(Math.abs(treeArcs[i].source-treeArcs[i].target));
            } else {
                arcExtraRadiusX = 0;
            }

            for (let q = 0; q < queryRelations.length; q++) {
                if (queryRelations[q].id == treeArcs[i].id) {
                    svgPathClass = "svg-path-match";
                    svgLabelClass = "svg-label-match";
                    break;
                }
            }

            select("#arcs")
                .append("path")
                .classed(svgPathClass, true)
                .attr("id", arcElements[1]+treeArcs[i].id)
                .attr("vector-effect", "non-scaling-stroke")
                // .attr("d", "M"+(pathSource+sourceOffset)+","+0+" A"+(20+arcScale(Math.abs(treeArcs[i].source-treeArcs[i].target)))+",10 0 0,1 "+(pathTarget+targetOffset)+","+0);
                .attr("d", "M"+(pathSource+sourceOffset)+","+0+" A"+(arcRadiusX+arcExtraRadiusX)+",10 0 0,1 "+(pathTarget+targetOffset)+","+0)
                .on("mouseover", selectArc(treeArcs[i].id))
                .on("mouseout", unselectArc(treeArcs[i].id));

            let centerCoord = this.getCenterCoordById("#"+arcElements[1]+treeArcs[i].id);

            // Adding a relation label (edge)
            if (centerCoord.x>0) {
                // A temporary one to get the size
                select("#arcs")
                    .append("text")
                    .classed(svgLabelClass, true)
                    .attr("id", arcElements[2]+treeArcs[i].id)
                    .text(treeArcs[i].dependency)
                    .attr("x", centerCoord.x)
                    .attr("y", centerCoord.y);

                let labelSizes = getSizesById("#"+arcElements[2]+treeArcs[i].id);
                // A real label that can be positioned correctly based on its sizes
                select("#"+arcElements[2]+treeArcs[i].id).remove();
                if (labelSizes.width>0) {
                    select("#arcs")
                        .append("text")
                        .classed(svgLabelClass, true)
                        .attr("id", arcElements[2]+treeArcs[i].id)
                        .text(treeArcs[i].dependency)
                        .attr("x", centerCoord.x-(labelSizes.width/2))
                        .attr("y", centerCoord.y)
                        .on("mouseover", selectArc(treeArcs[i].id))
                        .on("mouseout", unselectArc(treeArcs[i].id));
                }
            }
        }

        if (pathSource == pathTarget) {
            for (let q = 0; q < queryRelations.length; q++) {
                if (queryRelations[q].target == queryRelations[q].source) {
                    if (treeArcs[i].source == queryRelations[q].source) {
                        svgPathClass = "svg-path-match";
                        break;
                    }
                }
            }
        }

        // Arrow at the end of an arc
        const levelY = 0+1; // line where an arrow begins
        select("#arcs")
            .append("polygon")
            .classed(svgPathClass, true)
            .attr("id", arcElements[0] + treeArcs[i].id)
            .attr("vector-effect", "non-scaling-stroke")
            .attr("points", tokenCenter[treeArcs[i].target]+","+levelY+" "+(tokenCenter[treeArcs[i].target]+1)+","+(levelY-2)+" "+tokenCenter[treeArcs[i].target]+","+(levelY-1)+" "+(tokenCenter[treeArcs[i].target]-1)+","+(levelY-2))
            .on("mouseover", selectArc(treeArcs[i].id))
            .on("mouseout", unselectArc(treeArcs[i].id));
    }


    let arcsNode = getBBoxSafely("#arcs");
    let arcsHeight = arcsNode.height;

    // Adding root nodes only when we have all other arcs, since
    // we have to know the height of the tallest one
    for (let i = 0; i < treeArcs.length; i++) {
        let pathSource = tokenCenter[treeArcs[i].source];
        let pathTarget = tokenCenter[treeArcs[i].target];
        svgPathClass = "svg-path-normal";
        svgLabelClass = "svg-label-normal";

        if (pathSource == pathTarget) {
            for (let q = 0; q < queryRelations.length; q++) {
                if (queryRelations[q].target == queryRelations[q].source) {
                    if (treeArcs[i].source == queryRelations[q].source) {
                        svgPathClass = "svg-path-match";
                        svgLabelClass = "svg-label-match";
                        break;
                    }
                }
            }

            select("#arcs")
                .append("path")
                .classed(svgPathClass, true)
                .attr("id", arcElements[1]+treeArcs[i].id)
                .attr("vector-effect", "non-scaling-stroke")
                .attr("d", "M"+pathSource+","+(arcsHeight*(-1))+" L"+pathTarget+","+0)
                .on("mouseover", selectArc(treeArcs[i].id))
                .on("mouseout", unselectArc(treeArcs[i].id));

            select("#arcs")
                .append("text")
                .classed(svgLabelClass, true)
                .attr("id", arcElements[2]+treeArcs[i].id)
                .text(treeArcs[i].dependency)
                .attr("x", pathSource)
                .attr("y", arcsHeight*(-1));


            let labelSizes = getSizesById("#"+arcElements[2]+treeArcs[i].id);
            select("#"+arcElements[2]+treeArcs[i].id).remove();
            if (labelSizes.width>0) {
                select("#arcs")
                    .append("text")
                    .classed(svgLabelClass, true)
                    .attr("id", arcElements[2]+treeArcs[i].id)
                    .text(treeArcs[i].dependency)
                    .attr("x", pathSource-(labelSizes.width/2))
                    .attr("y", arcsHeight*(-1))
                    .on("mouseover", selectArc(treeArcs[i].id))
                    .on("mouseout", unselectArc(treeArcs[i].id));
            }
        }
    }

    arcsNode = getBBoxSafely("#arcs");
    arcsHeight = arcsNode.height;
    let centeringOffset = 0;

    if (((arcsHeight+tokenHeight)*scaleRatio)>sizes.height) {
        scaleRatio = sizes.height/(arcsHeight+tokenHeight);
        scaleRatio = Math.max(minScaleRatio, Math.min(scaleRatio, maxScaleRatio));
        centeringOffset = ((sizes.width-(tokenOffsetLeft*scaleRatio))/scaleRatio)/2;
    }

    // Positioning the image correctly (centering and moving to the bottom based on the arcs' height)
    select("#movable")
        .attr("transform", "translate("+centeringOffset+" "+arcsHeight+")");

    // Scaling the parent node (i.e. the whole image)
    select("#canvas")
        .attr("transform", "scale("+scaleRatio+" "+scaleRatio+")");
}
