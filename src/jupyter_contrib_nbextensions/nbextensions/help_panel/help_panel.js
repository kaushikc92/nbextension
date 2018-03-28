// Add help panel at right side of notebook window

define([
    'require',
    'jqueryui',
    'base/js/namespace',
    'base/js/events',
    'nbextensions/help_panel/cytoscape',
    'nbextensions/help_panel/d3'
], function (
    requirejs,
    $,
    IPython,
    events,
    cytoscape,
    d3
) {
    'use strict';

    /**
     * try to get bootstrap tooltip plugin.
     * The require call may fail, since the plugin doesn't seem to be included
     * in all Jupyter versions. In this case, we fallback to using jqueryui tooltips.
     */
    var have_bs_tooltips = false;
    requirejs(
        ['components/bootstrap/js/tooltip'],
        // we don't actually need to do anything with the return
        // just ensure that the plugin gets loaded.
        function () { have_bs_tooltips = true; },
        // The errback, error callback
        // The error has a list of modules that failed
        function (err) {
            var failedId = err.requireModules && err.requireModules[0];
            if (failedId === 'components/bootstrap/js/tooltip') {
                // could do something here, like load a cdn version.
                // For now, just ignore it.
                have_bs_tooltips = false;
            }
        }
    );

    // define default values for config parameters
    var params = {
        help_panel_add_toolbar_button: false
    };

    // update params with any specified in the server's config file
    function update_params () {
        var config = IPython.notebook.config;
        for (var key in params) {
            if (config.data.hasOwnProperty(key))
                params[key] = config.data[key];
        }
    }

    var initialize = function () {
        update_params();
        if (params.help_panel_add_toolbar_button) {
            $(IPython.toolbar.add_buttons_group([
                IPython.keyboard_manager.actions.register({
                    help   : 'Show help panel',
                    icon   : 'fa-book',
                    handler: function() {
                        var visible = toggleHelpPanel();
                        var btn = $(this);
                        setTimeout(function() { btn.blur(); }, 500);
                    }
                }, 'show-help-panel', 'help_panel'),
            ])).find('.btn').attr({
                id: 'btn_help_panel',
                'data-toggle': 'button',
                'aria-pressed': 'false'
            });
        }
    };

    var side_panel_min_rel_width = 10;
    var side_panel_max_rel_width = 90;
    var side_panel_start_width = 45;

    var build_side_panel = function (main_panel, side_panel, min_rel_width, max_rel_width) {
        if (min_rel_width === undefined) min_rel_width = 0;
        if (max_rel_width === undefined) max_rel_width = 100;

        side_panel.css('display','none');
        side_panel.insertAfter(main_panel);

        var side_panel_splitbar = $('<div class="side_panel_splitbar"/>');
        var side_panel_inner = $('<div class="side_panel_inner"/>');
        var side_panel_expand_contract = $('<i class="btn fa fa-expand hidden-print">');
        side_panel.append(side_panel_splitbar);
        side_panel.append(side_panel_inner);
        side_panel_inner.append(side_panel_expand_contract);

        side_panel_expand_contract.attr({
            title: 'expand/contract panel',
            'data-toggle': 'tooltip'
        }).tooltip({
            placement: 'right'
        }).click(function () {
            var open = $(this).hasClass('fa-expand');
            var site = $('#site');
            slide_side_panel(main_panel, side_panel,
                open ? 100 : side_panel.data('last_width') || side_panel_start_width);
            $(this).toggleClass('fa-expand', !open).toggleClass('fa-compress', open);

            var tooltip_text = (open ? 'shrink to not' : 'expand to') + ' fill the window';
            if (open) {
                side_panel.insertAfter(site);
                site.slideUp();
                $('#header').slideUp();
                side_panel_inner.css({'margin-left': 0});
                side_panel_splitbar.hide();
            }
            else {
                side_panel.insertAfter(main_panel);
                $('#header').slideDown();
                site.slideDown({
                    complete: function() { events.trigger('resize-header.Page'); }
                });
                side_panel_inner.css({'margin-left': ''});
                side_panel_splitbar.show();
            }

            if (have_bs_tooltips) {
                side_panel_expand_contract.attr('title', tooltip_text);
                side_panel_expand_contract.tooltip('hide').tooltip('fixTitle');
            }
            else {
                side_panel_expand_contract.tooltip('option', 'content', tooltip_text);
            }
        });

        // bind events for resizing side panel
        side_panel_splitbar.mousedown(function (md_evt) {
            md_evt.preventDefault();
            $(document).mousemove(function (mm_evt) {
                mm_evt.preventDefault();
                var pix_w = side_panel.offset().left + side_panel.outerWidth() - mm_evt.pageX;
                var rel_w = 100 * (pix_w) / side_panel.parent().width();
                rel_w = rel_w > min_rel_width ? rel_w : min_rel_width;
                rel_w = rel_w < max_rel_width ? rel_w : max_rel_width;
                //main_panel.css('width', (100 - rel_w) + '%');
                side_panel.css('width', rel_w + '%').data('last_width', rel_w);
            });
            return false;
        });
        $(document).mouseup(function (mu_evt) {
            $(document).unbind('mousemove');
        });

        return side_panel;
    };

    var slide_side_panel = function (main_panel, side_panel, desired_width) {

        var anim_opts = {
            step : function (now, tween) {
                //main_panel.css('width', 100 - now + '%');
            }
        };

        if (desired_width === undefined) {
            if (side_panel.is(':hidden')) {
                desired_width = (side_panel.data('last_width') || side_panel_start_width);
            }
            else {
                desired_width = 0;
            }
        }

        var visible = desired_width > 0;
        if (visible) {
            //main_panel.css({float: 'left', 'overflow-x': 'auto'});
            side_panel.show();
        }
        else {
            anim_opts['complete'] = function () {
                side_panel.hide();
                //main_panel.css({float : '', 'overflow-x': '', width: ''});
            };
        }

        side_panel.animate({width: desired_width + '%'}, anim_opts);
        return visible;
    };

    var populate_side_panel = function(side_panel) {
	var side_panel_inner = side_panel.find('.side_panel_inner');


    var svgContainerDiv = d3.select(".side_panel_inner").append("div");
    var svgContainer = svgContainerDiv.append("svg").attr("height",500).attr("width", 500);

    var nodeRadius = 25;
    var nodes = [
        { label: "A"},
        { label: "B"},
        { label: "C"},
        { label: "D"}
        ];

    var links = [
        {source: nodes[0], target: nodes[2]},
        {source: nodes[1], target: nodes[2]},
        {source: nodes[2], target: nodes[3]}
        ];

    svgContainer.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('refX', 17.5)
        .attr('refY', 2)
        .attr('markerWidth', 8)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .attr('fill', '#ccc')
        .append('path')
        .attr('d', 'M 0,0 V 4 L6,2 Z');

    var link = svgContainer.selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("marker-end", "url(#arrowhead)")
        //.attr("x1", function(d) { return d.source.x;})
        //.attr("y1", function(d) { return d.source.y })
        //.attr("x2", function(d) { return d.target.x })
        //.attr("y2", function(d) { return d.target.y })
        .style("stroke", "rgb(6,120,155)");

    /*
    var node = svgContainer.selectAll("circle .nodes")
        .data(nodes)
        .enter()
        .append("svg:circle")
        .attr("class", "nodes")
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; })
        .attr("r", nodeRadius)
        .attr("fill", "#d0d0e1");

    svgContainer.selectAll(".text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("x", function(d) { return d.x - 4; })
        .attr("y", function(d) { return d.y + 4; })
        .text(function(d) { return d.label; });
    */

    var node = svgContainer.selectAll('g')
        .data(nodes)
        .enter()
        .append("g");

    node.append("circle")
        .attr("r", nodeRadius)
        .attr("class", "node")
        .attr("fill", "#d0d0e1");

    node.append("text")
        .attr("text-anchor", "middle")
        .attr("y", 5)
        .text(function(d) { return d.label; });

    var charge = 700 * nodes.length;

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function(d) { return d.label; }))
        .force("charge", d3.forceManyBody().strength(-(charge)))
        .force("center", d3.forceCenter(250, 250));
        
    simulation.nodes(nodes).on("tick", tick);
    
    simulation.force("link").links(links);
     
    simulation.force("link").distance(150);

    //simulation.restart();
    //for (var i = 0; i < nodes.length * 100; ++i) simulation.tick();
    //simulation.stop();

    function tick() {

        var k = -12 * simulation.alpha();

        link
            .each(function(d) { d.source.y += k, d.target.y -= k; })
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node
            .attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });
//        node
//            .attr("cx", function(d) { return d.x; })
//            .attr("cy", function(d) { return d.y; });
    }
    /*
    svgContainer.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('refX', 17.5)
        .attr('refY', 2)
        .attr('markerWidth', 8)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .attr('fill', '#ccc')
        .append('path')
        .attr('d', 'M 0,0 V 4 L6,2 Z');

    var nodes = [
        { name: "nodeA" },
        { name: "nodeB" },
        { name: "nodeC" },
        { name: "nodeD" }
        ];

    var links = [
        { source: "nodeA", target: "nodeC" },
        { source: "nodeB", target: "nodeC" },
        { source: "nodeC", target: "nodeD" }
        ];
    
    //var simulation = 

    var link = svgContainer.selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('marker-end', 'url(#arrowhead)');

    var node = svgContainer.selectAll('g')
        .data(nodes)
        .enter()
        .append('g');

    node.append('circle')
        .attr('r', radius)
        .attr('class', 'node')
        .attr('fill', '#1BA1E2')

    node.append('text')
        .attr('y', 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('class', 'bold-text')
        .text(function(d) {
            return d.name;
            //if (d.name.length > 10) {
            //    return d.name.substring(0, 8) + '...';
            //}
            //return d.name;
        });

    var charge = 700 * nodes.length;

    var force = d3.layout.force()
        .size([500, 500])
        .nodes(nodes)
        .links(links)
        .linkDistance(150)
        .charge(-(charge))
        .gravity(1)
        .on('tick', tick);

    force.start();
    for (var i = 0; i < nodes.length * 100; ++i) force.tick();
    force.stop();

    function tick(e) {
        var k = -12 * e.alpha;
        link.each(function(d) { d.source.y -= k, d.target.y += k; })
            .attr('x2', function(d) { return d.source.x; })
            .attr('y2', function(d) { return d.source.y; })
            .attr('x1', function(d) { return d.target.x; })
            .attr('y1', function(d) { return d.target.y; });

        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    }

    /*
    /*

    var nodeRadius = "25px";
    var nodes = [
        {x: 200, y: 50, label: "A"},
        {x: 400, y: 50, label: "B"},
        {x: 300, y: 150, label: "C"},
        {x: 300, y: 250, label: "D"}
        ];

    var links = [
        {source: nodes[0], target: nodes[2]},
        {source: nodes[1], target: nodes[2]},
        {source: nodes[2], target: nodes[3]}
        ];

    svgContainer.selectAll(".line")
        .data(links)
        .enter()
        .append("line")
        .attr("x1", function(d) { return d.source.x;})
        .attr("y1", function(d) { return d.source.y })
        .attr("x2", function(d) { return d.target.x })
        .attr("y2", function(d) { return d.target.y })
        .style("stroke", "rgb(6,120,155)");
    
    svgContainer.selectAll("circle .nodes")
        .data(nodes)
        .enter()
        .append("svg:circle")
        .attr("class", "nodes")
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; })
        .attr("r", nodeRadius)
        .attr("fill", "#d0d0e1");

    svgContainer.selectAll(".text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("x", function(d) { return d.x - 4; })
        .attr("y", function(d) { return d.y + 4; })
        .text(function(d) { return d.label; });

    */
    };

    var toggleHelpPanel = function () {
        var main_panel = $('#notebook_panel');
        var side_panel = $('#side_panel');

        if (side_panel.length < 1) {
            side_panel = $('<div id="side_panel"/>');
            build_side_panel(main_panel, side_panel,
                side_panel_min_rel_width, side_panel_max_rel_width);
            populate_side_panel(side_panel);
        }

        var visible = slide_side_panel(main_panel, side_panel);
        if (params.help_panel_add_toolbar_button) {
            $('#btn_help_panel').toggleClass('active', visible);
        }
        return visible;
    };

    var load_ipython_extension = function () {
        $('head').append(
            $('<link/>', {
                rel: 'stylesheet',
                type:'text/css',
                href: requirejs.toUrl('./help_panel.css')
            })
        );
        return IPython.notebook.config.loaded.then(initialize);
    };

    return {
        load_ipython_extension : load_ipython_extension
    };
});
