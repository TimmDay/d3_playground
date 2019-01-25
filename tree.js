import React from 'react';
import {Button, Glyphicon, OverlayTrigger, Tooltip, DropdownButton, MenuItem} from 'react-bootstrap';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import {select} from 'd3-selection';

import {CopyToClipboard} from 'react-copy-to-clipboard';
import Alert from 'react-s-alert';
import {heightOf} from '../utils/utils';
import {getSizesById, getBBoxSafely} from './visualizations/Common';
import {createConstituencyTree} from './visualizations/Constituency';
import {createDependencyTree, d3ToTikz} from './visualizations/Dependency';

export class ToolTipWrapper extends React.Component {
    render() {
        return(
            <OverlayTrigger
                overlay={<Tooltip id={this.props.id}>{this.props.text}</Tooltip>}
                placement="top"
                delayShow={300}
                delayHide={150}
            >
            {this.props.children}
            </OverlayTrigger>
        )
    }
}
ToolTipWrapper.propTypes = {
    id: PropTypes.string,
    text: PropTypes.string
}
const combinedContainerSpacing = 72; // needed to calculate image height
const maximalImageHeight = 400;

const VizControls = ({isInteractiveMode, setInteractive, doZoomInOrOut, latexCode, input, exportSVG}) => {
    let zoomInButton =  <ToolTipWrapper id="zoomIn" text="Zoom in">
                            <Button onClick={() => doZoomInOrOut(true)} bsSize="xsmall">
                                <Glyphicon glyph="plus"/>
                            </Button>
                        </ToolTipWrapper>

    let zoomOutButton = <ToolTipWrapper id="zoomOut" text="Zoom out">
                            <Button onClick={() => doZoomInOrOut(false)} bsSize="xsmall">
                                <Glyphicon glyph="minus"/>
                            </Button>
                        </ToolTipWrapper>

    let interactiveModeButton;
    if (isInteractiveMode) {
        interactiveModeButton = <ToolTipWrapper id="turnOff" text="Turn off zooming and panning">
                                <Button onClick={() => setInteractive(false)} bsSize="xsmall">
                                    <Glyphicon glyph="move" style={{color:'red'}}/>
                                </Button>
                            </ToolTipWrapper>
    } else {
        interactiveModeButton = <ToolTipWrapper id="turnOn" text="Turn on zooming and panning">
                                <Button onClick={() => setInteractive(true)} bsSize="xsmall">
                                    <Glyphicon glyph="move"/>
                                </Button>
                            </ToolTipWrapper>
    }

    let exportDropdown =
        <ToolTipWrapper id="exportSVG" text="Export the visualisation">
            <DropdownButton id="export-visualisation" pullRight bsStyle="default" bsSize="xsmall"
                    title={<span><Glyphicon glyph="th" /> Save</span>}>
                {latexCode ?
                    <MenuItem eventKey="1" onSelect={() => Alert.success("LaTeX code was copied to the clipboard")}>
                        <CopyToClipboard text={latexCode}><span>Copy LaTeX to clipboard</span></CopyToClipboard>
                    </MenuItem>
                    : false }
                <MenuItem eventKey="2" onSelect={()=>exportSVG("svg")}>Save as SVG</MenuItem>
                <MenuItem eventKey="3" onSelect={()=>exportSVG("pdf")}>Save as PDF</MenuItem>
                <MenuItem eventKey="4" onSelect={()=>exportSVG("png")}>Save as PNG</MenuItem>
                <MenuItem eventKey="5" onSelect={()=>exportSVG("jpeg")}>Save as JPEG</MenuItem>
            </DropdownButton>
        </ToolTipWrapper>

    return (
        <div className="visualisation-controls">
            {zoomInButton}
            {zoomOutButton}
            {interactiveModeButton}
            {exportDropdown}
        </div>
    )
};

export default class Tree extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visualSizes: {height: 0, width: 0}
        }

        this.createConstituencyTree = createConstituencyTree.bind(this);
        this.createDependencyTree = createDependencyTree.bind(this);
        this.updateDimensions = this.updateDimensions.bind(this);
    }

    updateDimensions() {
        if (this.props.input.sentence) {
            const queryMatch = (this.props.input.queryMatch) ? this.props.input.queryMatch : [];
            const queryRelations = (this.props.input.queryRelations) ? this.props.input.queryRelations : [];
            const table = (this.props.input.table) ? this.props.input.table : [];
            const mainContaienrHeight = heightOf('main-container');
            const headerMenuContainerHeight = heightOf('header-menu-container');
            const queryContainerHeight = heightOf('query-container');
            const sentenceContainerHeight = heightOf('sentence-container');
            const footerContainerHeight = heightOf('footer-container');
            const contentTabHeight = heightOf('content-tab');
            const contentTabWidth = document.getElementById('content-tab').clientWidth;
            const innerWidth = window.innerWidth;
            const innerHeight = window.innerHeight;

            let visualSizes = {
                height: Math.min(innerHeight-(headerMenuContainerHeight+sentenceContainerHeight+footerContainerHeight+combinedContainerSpacing), maximalImageHeight),
                width: contentTabWidth
            };

            if (select("#image").empty()) {
                if (visualSizes.height>0) {
                    this.setState({visualSizes});

                    if (this.props.treebankType == "Constituency") {
                        this.createConstituencyTree(visualSizes, queryMatch, table);
                    }
                    if (this.props.treebankType == "Dependency") {
                        this.createDependencyTree(visualSizes, queryMatch, table, queryRelations);
                    }

                    if (this.state.isInteractive) {
                        this.zoomingAndPanning(this.zoomed);
                    }
                }
            }
        }
    }

    isVisualAreaReady() {
        let isReady = false;
        select("svg")
            .append("text")
            .attr("id", "testItem")
            .text("testText")
            .attr("x", 0)
            .attr("y", 0)
            .attr("opacity", 0);
        let testItem = getSizesById("#testItem");
        if ((testItem.width!=0) && (testItem.height!=0)) {
            isReady = true;
        }
        select("#testItem").remove();
        return isReady;
    }

    updateOnResize() {
        if (this.isVisualAreaReady()) {
            select("#image").remove();
            this.updateDimensions();
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.updateOnResize.bind(this));
        this.props.onRef(this);
        this.updateDimensions();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateOnResize.bind(this));
        this.props.onRef(this);
        this.props.onRef(undefined);
    }

    zoomingAndPanning(listener) {
        let zoomHandler = d3.zoom()
            .scaleExtent([0.8, 10])
            .on("zoom", listener);

        zoomHandler(select("svg"));

        if (listener == null) {
            // Manually unbind all scrolling event to restore the page scrolling
            select("svg")
                .on("mousedown.zoom", null)
                .on("mousemove.zoom", null)
                .on("dblclick.zoom", null)
                .on("touchstart.zoom", null)
                .on("wheel.zoom", null)
                .on("mousewheel.zoom", null)
                .on("MozMousePixelScroll.zoom", null);
        }
    }

    zoomed() {
        select("#image").attr("transform", d3.event.transform);
    }

    doZoomInOrOut(isZoomIn) {
        let scaleValue = 1.5
        if (!isZoomIn) {
            scaleValue = 0.5;
        }

        let zoom = d3.zoom()
            .scaleExtent([0.8, 10])
            .on("zoom", this.zoomed);

        select("svg")
            .transition()
            .call(zoom.scaleBy, scaleValue);
    }

    onCopy() {
        this.setState({copied: true});
    };

    getCenterCoordById(elementId) {
        let centerResult = {x: 0, y: 0};
        if (!select(elementId).empty()) {
            let bbox = getBBoxSafely(elementId);
            if (bbox) {
                centerResult.x = bbox.x+(bbox.width/2);
                centerResult.y = bbox.y;
            }
        }
        return centerResult;
    }

    exportSVG(extension) {
        let svg = select("svg").node().outerHTML;
        this.props.actions.exportVisualisation(this.props.treebankId, svg, "visualisation." + extension);
    }

    render() {
        let listener = null;
        let svgAreaClassName = "svg-interactive-curson-off";
        if (this.props.isInteractiveMode) {
            svgAreaClassName = "svg-interactive-curson-on";
            listener = this.zoomed;
        }
        this.zoomingAndPanning(listener);
        return(
            <div>
                <VizControls
                    isInteractiveMode={this.props.isInteractiveMode}
                    setInteractive={this.props.actions.setInteractiveMode.bind(this)}
                    doZoomInOrOut={this.doZoomInOrOut.bind(this)}
                    input={this.props.input}
                    latexCode={d3ToTikz(this.props.input)}
                    exportSVG={this.exportSVG.bind(this)}
                />
                <div className={svgAreaClassName}>
                    <svg
                        ref={node => this.node = node}
                        onWheel={this.handleWheelEvent}
                        onMouseDown={this.handleMouseDown}
                        onMouseUp={this.handleMouseUp}
                        onMouseMove={this.handleMouseMove}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox={`0 0 ${this.state.visualSizes.width} ${this.state.visualSizes.height}`}
                        preserveAspectRatio="xMidYMid meet"
                        width={this.state.visualSizes.width}
                        height={this.state.visualSizes.height}
                    >
                    </svg>
                </div>
            </div>
        )
    }
}

Tree.propTypes = {
    actions: PropTypes.object.isRequired,
    input: PropTypes.object.isRequired,
    treebankId: PropTypes.string.isRequired,
    treebankType: PropTypes.string.isRequired,
    isInteractiveMode: PropTypes.bool.isRequired
};
