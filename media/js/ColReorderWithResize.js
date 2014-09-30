/*
 * File:        ColReorderWithResize.js
 * Version:     1.0.7
 * CVS:         $Id$
 * Description: Allow columns to be reordered in a DataTable
 * Author:      Allan Jardine (www.sprymedia.co.uk)
 * Author:      Christophe Battarel (www.altairis.fr)
 * Created:     Wed Sep 15 18:23:29 BST 2010
 * Modified:    July 2011 by Christophe Battarel - christophe.battarel@altairis.fr (columns resizable)
 * Modified:    February 2012 by Martin Marchetta - martin.marchetta@gmail.com
 *  1. Made the "hot area" for resizing a little wider (it was a little difficult to hit the exact border of a column for resizing)
 *  2. Resizing didn't work at all when using scroller (that plugin splits the table into 2 different tables: one for the header and another one for the body, so when you resized the header, the data columns didn't follow)
 *  3. Fixed collateral effects of sorting feature
 *  4. If sScrollX is enabled (i.e. horizontal scrolling), when resizing a column the width of the other columns is not changed, but the whole
 *     table is resized to give an Excel-like behavior (good suggestion by Allan)
 * Modified:    February 2012 by Christophe Battarel - christophe.battarel@altairis.fr (ColReorder v1.0.5 adaptation)
 * Modified:    September 16th 2012 by Hassan Kamara - h@phrmc.com
 * Modified:    February 26th 2014 by Jay kraly -jaykraly@gmail.com
 * Modified:    July 28th 2014 by Johann Zelger - j.zelger@techdivision.com (DataTables 1.10.x & ColReorder v1.1.2 compatibility)
 * Modified:    September 01th 2014 by Johann Zelger - j.zelger@techdivision.com (Fixed state saving and fixed some bugs)
 * Language:    Javascript
 * License:     GPL v2 or BSD 3 point style
 * Project:     DataTables
 * Contact:     www.sprymedia.co.uk/contact
 * 
 * Copyright 2010-2011 Allan Jardine, all rights reserved.
 *
 * This source file is free software, under either the GPL v2 license or a
 * BSD style license, available at:
 *   http://datatables.net/license_gpl2
 *   http://datatables.net/license_bsd
 *
 */

(function($, window, document) {

    /**
     * Switch the key value pairing of an index array to be value key (i.e. the old value is now the
     * key). For example consider [ 2, 0, 1 ] this would be returned as [ 1, 2, 0 ].
     *
     * @method  fnInvertKeyValues
     * @param   array aIn Array to switch around
     * @returns array
     */
    function fnInvertKeyValues( aIn )
    {
        var aRet=[];
        for ( var i=0, iLen=aIn.length ; i<iLen ; i++ )
        {
            aRet[ aIn[i] ] = i;
        }
        return aRet;
    }

    /**
     * Modify an array by switching the position of two elements
     *
     * @method  fnArraySwitch
     * @param   array aArray Array to consider, will be modified by reference (i.e. no return)
     * @param   int iFrom From point
     * @param   int iTo Insert point
     * @returns void
     */
    function fnArraySwitch( aArray, iFrom, iTo )
    {
        var mStore = aArray.splice( iFrom, 1 )[0];
        aArray.splice( iTo, 0, mStore );
    }


    /**
     * Switch the positions of nodes in a parent node (note this is specifically designed for
     * table rows). Note this function considers all element nodes under the parent!
     *
     * @method  fnDomSwitch
     * @param   string sTag Tag to consider
     * @param   int iFrom Element to move
     * @param   int Point to element the element to (before this point), can be null for append
     * @returns void
     */
    function fnDomSwitch( nParent, iFrom, iTo )
    {
        var anTags = [];
        for ( var i=0, iLen=nParent.childNodes.length ; i<iLen ; i++ )
        {
            if ( nParent.childNodes[i].nodeType == 1 )
            {
                anTags.push( nParent.childNodes[i] );
            }
        }
        var nStore = anTags[ iFrom ];

        if ( iTo !== null )
        {
            nParent.insertBefore( nStore, anTags[iTo] );
        }
        else
        {
            nParent.appendChild( nStore );
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * DataTables plug-in API functions
     *
     * This are required by ColReorder in order to perform the tasks required, and also keep this
     * code portable, to be used for other column reordering projects with DataTables, if needed.
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Plug-in for DataTables which will reorder the internal column structure by taking the column
     * from one position (iFrom) and insert it into a given point (iTo).
     *
     * @method  $.fn.dataTableExt.oApi.fnColReorder
     * @param   object oSettings DataTables settings object - automatically added by DataTables!
     * @param   int iFrom Take the column to be repositioned from this point
     * @param   int iTo and insert it into this point
     * @returns void
     */
    $.fn.dataTableExt.oApi.fnColReorder = function ( oSettings, iFrom, iTo )
    {
        var v110 = $.fn.dataTable.Api ? true : false;
        var i, iLen, j, jLen, iCols=oSettings.aoColumns.length, nTrs, oCol;
        var attrMap = function ( obj, prop, mapping ) {
            if ( ! obj[ prop ] ) {
                return;
            }

            var a = obj[ prop ].split('.');
            var num = a.shift();

            if ( isNaN( num*1 ) ) {
                return;
            }

            obj[ prop ] = mapping[ num*1 ]+'.'+a.join('.');
        };

        /* Sanity check in the input */
        if ( iFrom == iTo )
        {
            /* Pointless reorder */
            return;
        }

        if ( iFrom < 0 || iFrom >= iCols )
        {
            this.oApi._fnLog( oSettings, 1, "ColReorder 'from' index is out of bounds: "+iFrom );
            return;
        }

        if ( iTo < 0 || iTo >= iCols )
        {
            this.oApi._fnLog( oSettings, 1, "ColReorder 'to' index is out of bounds: "+iTo );
            return;
        }

        /*
         * Calculate the new column array index, so we have a mapping between the old and new
         */
        var aiMapping = [];
        for ( i=0, iLen=iCols ; i<iLen ; i++ )
        {
            aiMapping[i] = i;
        }
        fnArraySwitch( aiMapping, iFrom, iTo );
        var aiInvertMapping = fnInvertKeyValues( aiMapping );


        /*
         * Convert all internal indexing to the new column order indexes
         */
        /* Sorting */
        for ( i=0, iLen=oSettings.aaSorting.length ; i<iLen ; i++ )
        {
            oSettings.aaSorting[i][0] = aiInvertMapping[ oSettings.aaSorting[i][0] ];
        }

        /* Fixed sorting */
        if ( oSettings.aaSortingFixed !== null )
        {
            for ( i=0, iLen=oSettings.aaSortingFixed.length ; i<iLen ; i++ )
            {
                oSettings.aaSortingFixed[i][0] = aiInvertMapping[ oSettings.aaSortingFixed[i][0] ];
            }
        }

        /* Data column sorting (the column which the sort for a given column should take place on) */
        for ( i=0, iLen=iCols ; i<iLen ; i++ )
        {
            oCol = oSettings.aoColumns[i];
            for ( j=0, jLen=oCol.aDataSort.length ; j<jLen ; j++ )
            {
                oCol.aDataSort[j] = aiInvertMapping[ oCol.aDataSort[j] ];
            }

            // Update the column indexes
            if ( v110 ) {
                oCol.idx = aiInvertMapping[ oCol.idx ];
            }
        }

        if ( v110 ) {
            // Update 1.10 optimised sort class removal variable
            $.each( oSettings.aLastSort, function (i, val) {
                oSettings.aLastSort[i].src = aiInvertMapping[ val.src ];
            } );
        }

        /* Update the Get and Set functions for each column */
        for ( i=0, iLen=iCols ; i<iLen ; i++ )
        {
            oCol = oSettings.aoColumns[i];

            if ( typeof oCol.mData == 'number' ) {
                oCol.mData = aiInvertMapping[ oCol.mData ];

                // regenerate the get / set functions
                oSettings.oApi._fnColumnOptions( oSettings, i, {} );
            }
            else if ( $.isPlainObject( oCol.mData ) ) {
                // HTML5 data sourced
                attrMap( oCol.mData, '_',      aiInvertMapping );
                attrMap( oCol.mData, 'filter', aiInvertMapping );
                attrMap( oCol.mData, 'sort',   aiInvertMapping );
                attrMap( oCol.mData, 'type',   aiInvertMapping );

                // regenerate the get / set functions
                oSettings.oApi._fnColumnOptions( oSettings, i, {} );
            }
        }


        /*
         * Move the DOM elements
         */
        if ( oSettings.aoColumns[iFrom].bVisible )
        {
            /* Calculate the current visible index and the point to insert the node before. The insert
             * before needs to take into account that there might not be an element to insert before,
             * in which case it will be null, and an appendChild should be used
             */
            var iVisibleIndex = this.oApi._fnColumnIndexToVisible( oSettings, iFrom );
            var iInsertBeforeIndex = null;

            i = iTo < iFrom ? iTo : iTo + 1;
            while ( iInsertBeforeIndex === null && i < iCols )
            {
                iInsertBeforeIndex = this.oApi._fnColumnIndexToVisible( oSettings, i );
                i++;
            }

            /* Header */
            nTrs = oSettings.nTHead.getElementsByTagName('tr');
            for ( i=0, iLen=nTrs.length ; i<iLen ; i++ )
            {
                fnDomSwitch( nTrs[i], iVisibleIndex, iInsertBeforeIndex );
            }

            /* Footer */
            if ( oSettings.nTFoot !== null )
            {
                nTrs = oSettings.nTFoot.getElementsByTagName('tr');
                for ( i=0, iLen=nTrs.length ; i<iLen ; i++ )
                {
                    fnDomSwitch( nTrs[i], iVisibleIndex, iInsertBeforeIndex );
                }
            }

            /* Body */
            for ( i=0, iLen=oSettings.aoData.length ; i<iLen ; i++ )
            {
                if ( oSettings.aoData[i].nTr !== null )
                {
                    fnDomSwitch( oSettings.aoData[i].nTr, iVisibleIndex, iInsertBeforeIndex );
                }
            }
        }

        /*
         * Move the internal array elements
         */
        /* Columns */
        fnArraySwitch( oSettings.aoColumns, iFrom, iTo );

        /* Search columns */
        fnArraySwitch( oSettings.aoPreSearchCols, iFrom, iTo );

        /* Array array - internal data anodes cache */
        for ( i=0, iLen=oSettings.aoData.length ; i<iLen ; i++ )
        {
            var data = oSettings.aoData[i];

            if ( v110 ) {
                // DataTables 1.10+
                if ( data.anCells ) {
                    fnArraySwitch( data.anCells, iFrom, iTo );
                }

                // For DOM sourced data, the invalidate will reread the cell into
                // the data array, but for data sources as an array, they need to
                // be flipped
                if ( data.src !== 'dom' && $.isArray( data._aData ) ) {
                    fnArraySwitch( data._aData, iFrom, iTo );
                }
            }
            else {
                // DataTables 1.9-
                if ( $.isArray( data._aData ) ) {
                    fnArraySwitch( data._aData, iFrom, iTo );
                }
                fnArraySwitch( data._anHidden, iFrom, iTo );
            }
        }

        /* Reposition the header elements in the header layout array */
        for ( i=0, iLen=oSettings.aoHeader.length ; i<iLen ; i++ )
        {
            fnArraySwitch( oSettings.aoHeader[i], iFrom, iTo );
        }

        if ( oSettings.aoFooter !== null )
        {
            for ( i=0, iLen=oSettings.aoFooter.length ; i<iLen ; i++ )
            {
                fnArraySwitch( oSettings.aoFooter[i], iFrom, iTo );
            }
        }

        // In 1.10 we need to invalidate row cached data for sorting, filtering etc
        if ( v110 ) {
            var api = new $.fn.dataTable.Api( oSettings );
            api.rows().invalidate();
        }

        /*
         * Update DataTables' event handlers
         */

        /* Sort listener */
        for ( i=0, iLen=iCols ; i<iLen ; i++ )
        {
            $(oSettings.aoColumns[i].nTh).off('click.DT');
            this.oApi._fnSortAttachListener( oSettings, oSettings.aoColumns[i].nTh, i );
        }


        /* Fire an event so other plug-ins can update */
        $(oSettings.oInstance).trigger( 'column-reorder', [ oSettings, {
            "iFrom": iFrom,
            "iTo": iTo,
            "aiInvertMapping": aiInvertMapping
        } ] );
    };


    /**
     * ColReorder provides column visiblity control for DataTables
     *
     * @class ColReorder
     * @constructor
     * @param {object} DataTables settings object
     * @param {object} ColReorder options
     */
    ColReorder = function( oDTSettings, oOpts )
    {
        /* Santiy check that we are a new instance */
        if ( !this.CLASS || this.CLASS != "ColReorder" )
        {
            alert( "Warning: ColReorder must be initialised with the keyword 'new'" );
        }

        if ( typeof oOpts == 'undefined' )
        {
            oOpts = {};
        }


        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Public class variables
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

        /**
         * @namespace Settings object which contains customisable information for ColReorder instance
         */
        this.s = {
            /**
             * DataTables settings object
             *  @property dt
             *  @type     Object
             *  @default  null
             */
            "dt": null,

            /**
             * Initialisation object used for this instance
             *  @property init
             *  @type     object
             *  @default  {}
             */
            "init": oOpts,

            /**
             * Allow Reorder functionnality
             *  @property allowReorder
             *  @type     boolean
             *  @default  true
             */
            "allowReorder": true,

            /**
             * Allow Resize functionnality
             *  @property allowResize
             *  @type     boolean
             *  @default  true
             */
            "allowResize": true,

            /**
             * Number of columns to fix (not allow to be reordered)
             *  @property fixed
             *  @type     int
             *  @default  0
             */
            "fixed": 0,

            /**
             * Callback function for once the reorder has been done
             *  @property dropcallback
             *  @type     function
             *  @default  null
             */
            "dropCallback": null,

            /**
             * Callback function for once the resizing has been done
             *
             * @property resizeCallback
             * @type {Function}
             * @default null
             */
            "resizeCallback": null,

            /**
             * @namespace Information used for the mouse drag
             */
            "mouse": {
                "startX": -1,
                "startY": -1,
                "offsetX": -1,
                "offsetY": -1,
                "target": -1,
                "targetIndex": -1,
                "fromIndex": -1
            },

            /**
             * Information which is used for positioning the insert cusor and knowing where to do the
             * insert. Array of objects with the properties:
             *   x: x-axis position
             *   to: insert point
             *  @property aoTargets
             *  @type     array
             *  @default  []
             */
            "aoTargets": [],

            /**
             * Minimum width for columns (in pixels)
             * Default is 10. If set to 0, columns can be resized to nothingness.
             * @property minResizeWidth
             * @type     integer
             * @default  10
             */
            "minResizeWidth": 10,

            /**
             * Method to use for dealing with change in column size.  Choices are :
             *  greedy - as column gets bigger, take space from the neighbor, eventually push the table wider
             *  layout - set table-layout to fixed and width to auto, let browser expand the grid.
             *  		 layout should be faster than setting the width of the table ourselves
             *  table - add width to the parent table as column gets larger. should work like layout but
             *  		 a little slower
             *
             * @property resizeStyle
             * @type     string
             * @default  greedy
             */
            "resizeStyle": "greedy",


            /**
             * Callback called after each time the table is resized
             * This could be multiple times on one mouse move.
             * useful for resizing a containing element.
             * Passed the table element, th element, and the size change
             * @property fnResizeTableCallback
             * @type     function
             * @default  function(table, newSize, sizeChange) {}
             */
            "fnResizeTableCallback": function(){}
        };


        /**
         * @namespace Common and useful DOM elements for the class instance
         */
        this.dom = {
            /**
             * Dragging element (the one the mouse is moving)
             *  @property drag
             *  @type     element
             *  @default  null
             */
            "drag": null,

            /**
             * Resizing a column
             *  @property drag
             *  @type     element
             *  @default  null
             */
            "resize": null,

            /**
             * The insert cursor
             *  @property pointer
             *  @type     element
             *  @default  null
             */
            "pointer": null
        };

        /* Store the table size */
        this.table_size = -1;

        /* Store the header scrollHeadTableHeadRow so we only have to find it once */
        this.scrollHeadTableHeadRow=null;

        /* Store the scrollBodyTableHeadRow so we only have to find it once */
        this.scrollBodyTableHeadRow=null;

        /* Constructor logic */
        this.s.dt = oDTSettings.oInstance.fnSettings();
        this._fnConstruct();

        /* Add draw callback */
        oDTSettings.oApi._fnCallbackReg(oDTSettings, 'aoDrawCallback', jQuery.proxy(this._fnDraw, this), 'ColReorder');

        /* Add destroy callback */
        oDTSettings.oApi._fnCallbackReg(oDTSettings, 'aoDestroyCallback', jQuery.proxy(this._fnDestroy, this), 'ColReorder');

        /* Store the instance for later use */
        ColReorder.aoInstances.push( this );

        this.isOldIE=$.browser && $.browser.msie && ($.browser.version == "6.0" || $.browser.version == "7.0" || $.browser.version == "8.0")

        // In IE8 and below in quirks mode, layout doesn't expand the table, so force it to table style
        if (this.isOldIE && document.documentMode && document.documentMode==5
            && this.s.resizeStyle=="layout") {
            this.s.resizeStyle="table";
            alert("Your Internet Explorer browser is operating in Quirks mode.  This mode is not supported by the dataTables plugin.");
            console.log("ColReorderWithResize is using table resize style instead of layout in IE8 and below.");
        }

        // Set table layout fixed for layout and greedy resizeStyle.  The data table doesn't change with greedy style
        // if layout is not fixed.  Also allows cells to contract to cover long text.
        if (this.s.resizeStyle=="layout" || this.s.resizeStyle=="greedy") {
            $(this.s.dt.nTable).css('table-layout','fixed');
            $('.dataTables_scrollHead table').css('table-layout','fixed');
            $('.dataTables_scrollBody table').css('table-layout','fixed');
        }

        return this;
    };


    ColReorder.prototype = {
        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Public methods
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
        "fnReset": function ()
        {
            var a = [];
            for ( var i=0, iLen=this.s.dt.aoColumns.length ; i<iLen ; i++ )
            {
                a.push( this.s.dt.aoColumns[i]._ColReorder_iOrigCol );
            }

            this._fnOrderColumns( a );

            return this;
        },

        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Private methods (they are of course public in JS, but recommended as private)
         * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

        /**
         * Constructor logic
         *  @method  _fnConstruct
         *  @returns void
         *  @private
         */
        "_fnConstruct": function ()
        {
            var that = this;
            var iLen = this.s.dt.aoColumns.length;
            var i;

            /* allow reorder */
            if ( typeof this.s.init.allowReorder != 'undefined' )
            {
                this.s.allowReorder = this.s.init.allowReorder;
            }

            /* allow resize */
            if ( typeof this.s.init.allowResize != 'undefined' )
            {
                this.s.allowResize = this.s.init.allowResize;
            }

            if (typeof this.s.init.minResizeWidth != 'undefined') {
                this.s.minResizeWidth = this.s.init.minResizeWidth;
            }

            if (typeof this.s.init.resizeStyle != 'undefined') {
                this.s.resizeStyle = this.s.init.resizeStyle;
            }

            if (typeof this.s.init.fnResizeTableCallback == 'function') {
                this.s.fnResizeTableCallback = this.s.init.fnResizeTableCallback;
            }

            /* Columns discounted from reordering - counting left to right */
            if ( this.s.init.iFixedColumns )
            {
                this.s.fixed = this.s.init.iFixedColumns;
            }

            /* Columns discounted from reordering - counting right to left */
            this.s.fixedRight = this.s.init.iFixedColumnsRight ?
                this.s.init.iFixedColumnsRight :
                0;

            /* Resize callback initialisation option */
            if ( this.s.init.fnResizeCallback )
            {
                this.s.resizeCallback = this.s.init.fnResizeCallback;
            }

            /* Drop callback initialisation option */
            if ( this.s.init.fnReorderCallback )
            {
                this.s.dropCallback = this.s.init.fnReorderCallback;
            }

            /* Add event handlers for the drag and drop, and also mark the original column order */
            for ( i = 0; i < iLen; i++ )
            {
                if ( i > this.s.fixed-1 && i < iLen - this.s.fixedRight )
                {
                    this._fnMouseListener( i, this.s.dt.aoColumns[i].nTh );
                }

                /* Mark the original column order for later reference */
                this.s.dt.aoColumns[i]._ColReorder_iOrigCol = i;
            }

            /* State saving */
            this.s.dt.oApi._fnCallbackReg( this.s.dt, 'aoStateSaveParams', function (oS, oData) {
                that._fnStateSave.call( that, oData );
            }, "ColReorder_State" );

            /* An initial column order has been specified */
            var aiOrder = null;
            if ( this.s.init.aiOrder )
            {
                aiOrder = this.s.init.aiOrder.slice();
            }

            /* State loading, overrides the column order given */
            if ( this.s.dt.oLoadedState && typeof this.s.dt.oLoadedState.ColReorder != 'undefined' &&
                this.s.dt.oLoadedState.ColReorder.length == this.s.dt.aoColumns.length )
            {
                aiOrder = this.s.dt.oLoadedState.ColReorder;
            }

            /* If we have an order to apply - do so */
            if ( aiOrder )
            {
                /* We might be called during or after the DataTables initialisation. If before, then we need
                 * to wait until the draw is done, if after, then do what we need to do right away
                 */
                if ( !that.s.dt._bInitComplete )
                {
                    var bDone = false;
                    this.s.dt.aoDrawCallback.push( {
                        "fn": function () {
                            if ( !that.s.dt._bInitComplete && !bDone )
                            {
                                bDone = true;
                                var resort = fnInvertKeyValues( aiOrder );
                                that._fnOrderColumns.call( that, resort );
                            }
                        },
                        "sName": "ColReorder_Pre"
                    } );
                }
                else
                {
                    var resort = fnInvertKeyValues( aiOrder );
                    that._fnOrderColumns.call( that, resort );
                }
            }
            else {
                this._fnSetColumnIndexes();
            }

            // State loading for columns width and user's visibility
            if (this.s.dt.oLoadedState) {
                for ( i=0, iLen = this.s.dt.oLoadedState.columns.length ; i < iLen ; i++ ) {
                    var col = this.s.dt.oLoadedState.columns[i];
                    // restore width on columns
                    this.s.dt.aoColumns[i].sWidth = col.width;
                    this.s.dt.aoColumns[i].width = col.width;
                }
            }

        },

        /**
         * Set the column order from an array
         *  @method  _fnOrderColumns
         *  @param   array a An array of integers which dictate the column order that should be applied
         *  @returns void
         *  @private
         */
        "_fnOrderColumns": function ( a )
        {
            if ( a.length != this.s.dt.aoColumns.length )
            {
                this.s.dt.oInstance.oApi._fnLog( this.s.dt, 1, "ColReorder - array reorder does not "+
                    "match known number of columns. Skipping." );
                return;
            }

            for ( var i=0, iLen=a.length ; i<iLen ; i++ )
            {
                var currIndex = $.inArray( i, a );
                if ( i != currIndex )
                {
                    /* Reorder our switching array */
                    fnArraySwitch( a, currIndex, i );

                    /* Do the column reorder in the table */
                    this.s.dt.oInstance.fnColReorder( currIndex, i );
                }
            }

            /* When scrolling we need to recalculate the column sizes to allow for the shift */
            if ( this.s.dt.oScroll.sX !== "" || this.s.dt.oScroll.sY !== "" )
            {
                this.s.dt.oInstance.fnAdjustColumnSizing();
            }

            /* Save the state */
            this.s.dt.oInstance.oApi._fnSaveState( this.s.dt );

            this._fnSetColumnIndexes();
        },

        /**
         * Because we change the indexes of columns in the table, relative to their starting point
         * we need to reorder the state columns to what they are at the starting point so we can
         * then rearrange them again on state load!
         *
         * @method  _fnStateSave
         * @param   object oState DataTables state
         * @returns string JSON encoded cookie string for DataTables
         * @private
         */
        "_fnStateSave": function ( oState )
        {
            var i, iLen, aCopy, iOrigColumn;
            var oSettings = this.s.dt;
            var columns = oSettings.aoColumns;

            oState.ColReorder = [];

            /* Resizing */
            if( oState.columns ) {
                for ( i=0, iLen=columns.length ; i<iLen ; i++ )
                {
                    oState.columns[i].width = columns[i].width;
                }
            }

            /* Sorting */
            if ( oState.aaSorting ) {
                // 1.10.0-
                for ( i=0 ; i<oState.aaSorting.length ; i++ ) {
                    oState.aaSorting[i][0] = columns[ oState.aaSorting[i][0] ]._ColReorder_iOrigCol;
                }

                var aSearchCopy = $.extend( true, [], oState.aoSearchCols );

                for ( i=0, iLen=columns.length ; i<iLen ; i++ )
                {
                    iOrigColumn = columns[i]._ColReorder_iOrigCol;

                    /* Column filter */
                    oState.aoSearchCols[ iOrigColumn ] = aSearchCopy[i];

                    /* Visibility */
                    oState.abVisCols[ iOrigColumn ] = columns[i].bVisible;

                    /* Column reordering */
                    oState.ColReorder.push( iOrigColumn );
                }
            }
            else if ( oState.order ) {
                // 1.10.1+
                for ( i=0 ; i<oState.order.length ; i++ ) {
                    oState.order[i][0] = columns[ oState.order[i][0] ]._ColReorder_iOrigCol;
                }

                var stateColumnsCopy = $.extend( true, [], oState.columns );

                for ( i=0, iLen=columns.length ; i<iLen ; i++ )
                {
                    iOrigColumn = columns[i]._ColReorder_iOrigCol;

                    /* Columns */
                    oState.columns[ iOrigColumn ] = stateColumnsCopy[i];

                    /* Column reordering */
                    oState.ColReorder.push( iOrigColumn );
                }
            }
        },


        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Mouse drop and drag
         */

        /**
         * Add a mouse down listener to a particluar TH element
         *  @method  _fnMouseListener
         *  @param   int i Column index
         *  @param   element nTh TH element clicked on
         *  @returns void
         *  @private
         */
        "_fnMouseListener": function ( i, nTh )
        {
            var that = this;

            //Martin Marchetta (rebind events since after column re-order they use wrong column indices)
            $(nTh).unbind('mousemove.ColReorder');
            $(nTh).unbind('mousedown.ColReorder');
            ////////////////

            // listen to mousemove event for resize
            if (this.s.allowResize) {
                $(nTh).bind( 'mousemove.ColReorder', function (e) {
                    if ( that.dom.drag === null && that.dom.resize === null)
                    {
                        /* Store information about the mouse position */
                        var nThTarget = e.target.nodeName == "TH" ? e.target : $(e.target).parents('TH')[0];
                        var offset = $(nThTarget).offset();
                        var nLength = $(nThTarget).innerWidth();

                        /* are we on the col border (if so, resize col) */
                        if (Math.abs(e.pageX - Math.round(offset.left + nLength)) <= 5)
                        {
                            // check if column is allowed for resizing
                            if (that.s.dt.aoColumns[i].resizable === true) {
                                $(nThTarget).css({'cursor': 'col-resize'});
                            }
                        }
                        else
                        // check if column is allowed for resizing
                        if (that.s.dt.aoColumns[i].dragable === true) {
                            $(nThTarget).css({'cursor': 'pointer'});
                        }
                    }
                } );
            }

            // listen to mousedown event
            $(nTh).bind( 'mousedown.ColReorder', function (e) {
                e.preventDefault();
                that._fnMouseDown.call( that, e, nTh, i ); //Martin Marchetta: added the index of the column dragged or resized
                return false;
            } );
        },

        /**
         * Mouse down on a TH element in the table header
         *  @method  _fnMouseDown
         *  @param   event e Mouse event
         *  @param   element nTh TH element to be dragged
         *  @param 	 i The column that's resized/dragged
         *  @returns void
         *  @private
         */
        "_fnMouseDown": function ( e, nTh, i )
        {
            var that = this;

            /* are we resizing a column ? */
            if ($(nTh).css('cursor') == 'col-resize') {
                this.s.mouse.startX = e.pageX;
                this.s.mouse.startWidth = $(nTh).width();
                this.s.mouse.resizeElem = $(nTh);
                var nThNext = $(nTh).next();
                this.s.mouse.nextStartWidth = $(nThNext).width();
                that.dom.resize = true;
                ////////////////////
                //Martin Marchetta
                //a. Disable column sorting so as to avoid issues when finishing column resizing
                this.s.dt.aoColumns[i].bSortable = false;
                //b. Disable Autowidth feature (now the user is in charge of setting column width so keeping this enabled looses changes after operations)
                this.s.dt.oFeatures.bAutoWidth = false;
                ////////////////////
            }
            else if (this.s.allowReorder) {
                that.dom.resize = null;

                /* Store information about the mouse position */
                var target = $(e.target).closest('th, td');
                var offset = target.offset();
                var idx = parseInt( $(nTh).attr('data-column-index'), 10 );

                if ( idx === undefined ) {
                    return;
                }

                this.s.mouse.startX = e.pageX;
                this.s.mouse.startY = e.pageY;
                this.s.mouse.offsetX = e.pageX - offset.left;
                this.s.mouse.offsetY = e.pageY - offset.top;
                this.s.mouse.target = this.s.dt.aoColumns[ idx ].nTh;//target[0];
                this.s.mouse.targetIndex = idx;
                this.s.mouse.fromIndex = idx;

                this._fnRegions();

                /* Add event handlers to the document */
                $(document)
                    .on( 'mousemove.ColReorder', function (e) {
                        that._fnMouseMove.call(that, e, i);
                    } )
                    .on( 'mouseup.ColReorder', function (e) {
                        that._fnMouseUp.call(that, e, i);
                    } );

            }

            /* Add event handlers to the document */
            $(document).bind( 'mousemove.ColReorder', function (e) {
                that._fnMouseMove.call(that, e, i); //Martin Marchetta: Added index of the call being dragged or resized
            } );

            $(document).bind( 'mouseup.ColReorder', function (e) {
                //Martin Marcheta: Added this small delay in order to prevent collision with column sort feature (there must be a better
                //way of doing this, but I don't have more time to digg into it)
                setTimeout(function(){
                    that._fnMouseUp.call(that, e, i );  //Martin Marchetta: Added index of the call being dragged or resized
                }, 10);
            } );
        },

        /**
         * Deal with a mouse move event while dragging a node
         *  @method  _fnMouseMove
         *  @param   event e Mouse event
         *  @param   colResized Index of the column that's being dragged or resized (index within the internal model, not the visible order)
         *  @returns void
         *  @private
         */
        "_fnMouseMove": function ( e, colResized )
        {
            var that = this;

            /* are we resizing a column ? */
            if (this.dom.resize) {

                // check if column is not allowed for resizing and return.
                if (this.s.dt.aoColumns[colResized].resizable === false) {
                    return;
                }

                var nTh = this.s.mouse.resizeElem;
                var nThNext = $(nTh).next();
                var moveLength = e.pageX-this.s.mouse.startX;
                var scrollXEnabled = this.s.dt.sScrollX === undefined ? false: true;
                var newWidth = this.s.mouse.startWidth + moveLength;
                var minResizeWidth=this.s.minResizeWidth;

                if (minResizeWidth=="initial") {
                    minResizeWidth=this.s.dt.aoColumns[colResized].sWidthOrig;
                    if (minResizeWidth!=null) {
                        // try to cache the parsed value so we don't have to do this every event
                        minResizeWidth=this.s.dt.aoColumns[colResized].sWidthOrigInt;
                        if (minResizeWidth==null) {
                            // grab the string version
                            minResizeWidth=this.s.dt.aoColumns[colResized].sWidthOrig;
                            // remove px and parse to an int
                            minResizeWidth=parseInt(minResizeWidth.substring(0, minResizeWidth.length -2));
                            // save for next time
                            this.s.dt.aoColumns[colResized].sWidthOrigInt=minResizeWidth;
                        }
                    }
                }

                // enforce a minimum width, should allow "initial" which uses sWidth set in init
                if (newWidth < minResizeWidth) {
                    newWidth = minResizeWidth;
                    moveLength = newWidth - this.s.mouse.startWidth ;
                }

                if (moveLength != 0) {
                    // if resize style is greedy resize the column next to the column that is being resized
                    if (this.s.resizeStyle=="greedy") {
                        $(nThNext).width(this.s.mouse.nextStartWidth - moveLength);
                    }

                    // resize the actual column
                    $(nTh).width(this.s.mouse.startWidth + moveLength);

                    // handle the tables involved if we are scrolling x or y
                    if(this.s.dt.nScrollBody){
                        //Since some columns might have been hidden, find the correct one to resize in the table's body
                        var visibleColumnIndex;
                        var currentColumnIndex;
                        visibleColumnIndex = -1;
                        for(currentColumnIndex=-1; currentColumnIndex < this.s.dt.aoColumns.length-1 && currentColumnIndex != colResized; currentColumnIndex++){
                            if(this.s.dt.aoColumns[currentColumnIndex+1].bVisible)
                                visibleColumnIndex++;
                        }

                        // find the table head row of the scroll body.  prefer the one set by a modified datatables.
                        var scrollBodyTableHeadRow=null;
                        // if datatables did not supply it, then find it ourselves from the scrollBody.  not caching it
                        // since sorting a table will create a new hidden header
                        if (scrollBodyTableHeadRow==null) {
                            // use the nScrollBody set by dataTables to find
                            var scrollingTableHead = this.s.dt.nScrollBody.getElementsByTagName('thead')[0];
                            scrollBodyTableHeadRow = scrollingTableHead.getElementsByTagName('tr')[0];
                        }

                        // Resize the hidden header row in the body, this will cause the data rows to be resized
                        //  if resize style is greedy, change the size of the next column
                        if (moveLength != 0 && this.s.resizeStyle=="greedy"){
                            // $(scrollBodyTableHeadRow.childNodes[visibleColumnIndex+1]).width(this.s.mouse.nextStartWidth - moveLength);
                        }
                        // resize the actual th in the hidden header row
                        $(scrollBodyTableHeadRow.childNodes[visibleColumnIndex]).width(this.s.mouse.startWidth + moveLength);

                        // if resize style is table, change the size of the body table to account for the new size of the column
                        if (this.s.resizeStyle=="table") {
                            // find the table head row of the header.  prefer any cached header
                            if (this.scrollHeadTableHeadRow==null) {
                                // if not found, prefer the one set by a modified datatables.
                                this.scrollHeadTableHeadRow=this.s.dt.nVisibleHeaderRow[0];
                                // if datatables did not supply it, then find it ourselves from the scrollHead.
                                if (this.scrollHeadTableHeadRow==null) {
                                    // use the nScrollHead set by dataTables to find
                                    var visibleTableHead = this.s.dt.nScrollHead.getElementsByTagName('thead')[0];
                                    this.scrollHeadTableHeadRow = visibleTableHead.getElementsByTagName('tr')[0];
                                }
                            }

                            // resize the table in the scroll header
                            if (this.scrollHeadTableHeadRow!=null) {
                                $headerTable = $(this.scrollHeadTableHeadRow.parentNode.parentNode);
                                //Keep the current table's width so that we can increase the original table width by the mouse move length
                                if (this.table_size < 0) {
                                    this.table_size = $headerTable.width();
                                }
                                $headerTable.width(this.table_size + moveLength);

                                // and resize the table in the scroll body
                                $(this.s.dt.nTable).width(this.table_size + moveLength);
                            }
                        }
                        else {
                            // bugfix for where table ths are automatically expanding when table size is bigger than th's calculated width
                            var scrollHead = $(this.s.dt.nScrollHead);
                            // get the width-calculating elements and set the width to a value that is too low to hold all th's
                            var elems = scrollHead.find('.dataTables_scrollHeadInner, .dataTables_scrollHeadInner table').css('width', '100px');
                            // get table head
                            var thead = elems.find('thead');
                            // get table head's real width
                            var width = thead.outerWidth();

                            // set the real width on the table
                            elems.css('width', width);
                        }
                    }

                    // resize style is table and no scroll x, so just resize the table
                    else if (this.s.resizeStyle=="table") {
                        //Keep the current table's width so that we can increase the original table width by the mouse move length
                        if (this.table_size < 0) {
                            this.table_size = $(this.s.dt.nTable).width();
                        }
                        var newTableWidth = this.table_size + moveLength;
                        $(this.s.dt.nTable).width(newTableWidth);
                    }

                    // trigger callback handler
                    this.s.fnResizeTableCallback($(this.s.dt.nTable),$(nTh),moveLength);
                }

                return;
            }
            else if (this.s.allowReorder) {

                // check if column is not allowed for draging and return.
                if (this.s.dt.aoColumns[colResized].dragable === false) {
                    return;
                }

                if ( this.dom.drag === null )
                {
                    /* Only create the drag element if the mouse has moved a specific distance from the start
                     * point - this allows the user to make small mouse movements when sorting and not have a
                     * possibly confusing drag element showing up
                     */
                    if ( Math.pow(
                        Math.pow(e.pageX - this.s.mouse.startX, 2) +
                            Math.pow(e.pageY - this.s.mouse.startY, 2), 0.5 ) < 5 )
                    {
                        return;
                    }

                    this._fnCreateDragNode();
                }

                /* Position the element - we respect where in the element the click occured */
                this.dom.drag.css( {
                    left: e.pageX - this.s.mouse.offsetX,
                    top: e.pageY - this.s.mouse.offsetY
                } );

                /* Based on the current mouse position, calculate where the insert should go */
                var bSet = false;
                var lastToIndex = this.s.mouse.toIndex;

                for ( var i=1, iLen=this.s.aoTargets.length ; i<iLen ; i++ )
                {
                    if ( e.pageX < this.s.aoTargets[i-1].x + ((this.s.aoTargets[i].x-this.s.aoTargets[i-1].x)/2) )
                    {
                        this.dom.pointer.css( 'left', this.s.aoTargets[i-1].x );
                        this.s.mouse.toIndex = this.s.aoTargets[i-1].to;
                        bSet = true;
                        break;
                    }
                }

                // The insert element wasn't positioned in the array (less than
                // operator), so we put it at the end
                if ( !bSet )
                {
                    this.dom.pointer.css( 'left', this.s.aoTargets[this.s.aoTargets.length-1].x );
                    this.s.mouse.toIndex = this.s.aoTargets[this.s.aoTargets.length-1].to;
                }

                // Perform reordering if realtime updating is on and the column has moved
                if ( this.s.init.bRealtime && lastToIndex !== this.s.mouse.toIndex ) {
                    this.s.dt.oInstance.fnColReorder( this.s.mouse.fromIndex, this.s.mouse.toIndex );
                    this.s.mouse.fromIndex = this.s.mouse.toIndex;
                    this._fnRegions();
                }
            }
        },

        /**
         * Finish off the mouse drag and insert the column where needed
         *  @method  _fnMouseUp
         *  @param   event e Mouse event
         *  @param colResized The index of the column that was just dragged or resized (index within the internal model, not the visible order).
         *  @returns void
         *  @private
         */
        "_fnMouseUp": function ( e, colResized)
        {
            var that = this;

            $(document).unbind( 'mousemove.ColReorder' );
            $(document).unbind( 'mouseup.ColReorder' );

            if ( this.dom.drag !== null )
            {
                /* Remove the guide elements */
                this.dom.drag.remove();
                this.dom.pointer.remove();
                this.dom.drag = null;
                this.dom.pointer = null;

                /* Actually do the reorder */
                this.s.dt.oInstance.fnColReorder( this.s.mouse.fromIndex, this.s.mouse.toIndex );
                this._fnSetColumnIndexes();

                /* When scrolling we need to recalculate the column sizes to allow for the shift */
                if ( this.s.dt.oScroll.sX !== "" || this.s.dt.oScroll.sY !== "" )
                {
                    this.s.dt.oInstance.fnAdjustColumnSizing();
                }

                // call drop callback if exists
                if ( this.s.dropCallback !== null )
                {
                    this.s.dropCallback.call( this );
                }

                ////////////
                //Martin Marchetta: Re-initialize so as to register the new column order
                //(otherwise the events remain bound to the original column indices)
                // this._fnConstruct();
                ///////////

                /* Save the state */
                this.s.dt.oInstance.oApi._fnSaveState( this.s.dt );
            }
            ///////////////////////////////////////////////////////
            //Martin Marchetta
            else if(this.dom.resize !== null) {
                var i;
                var j;
                var currentColumn;
                var nextVisibleColumnIndex;
                var previousVisibleColumnIndex;
                var scrollXEnabled;

                //Re-enable column sorting
                this.s.dt.aoColumns[colResized].bSortable = true;

                //Save the new resized column's width with old and new api
                this.s.dt.aoColumns[colResized].sWidth = $(this.s.mouse.resizeElem).innerWidth() + "px";
                this.s.dt.aoColumns[colResized].width = $(this.s.mouse.resizeElem).innerWidth() + "px";

                //If other columns might have changed their size, save their size too
                scrollXEnabled = this.s.dt.oInit.sScrollX === "" ? false:true;
                if(!scrollXEnabled){
                    //The colResized index (internal model) here might not match the visible index since some columns might have been hidden
                    for(nextVisibleColumnIndex=colResized+1; nextVisibleColumnIndex < this.s.dt.aoColumns.length; nextVisibleColumnIndex++){
                        if(this.s.dt.aoColumns[nextVisibleColumnIndex].bVisible)
                            break;
                    }

                    for(previousVisibleColumnIndex=colResized-1; previousVisibleColumnIndex >= 0; previousVisibleColumnIndex--){
                        if(this.s.dt.aoColumns[previousVisibleColumnIndex].bVisible)
                            break;
                    }

                    if(this.s.dt.aoColumns.length > nextVisibleColumnIndex)
                        this.s.dt.aoColumns[nextVisibleColumnIndex].sWidth = $(this.s.mouse.resizeElem).next().innerWidth() + "px";
                    else{ //The column resized is the right-most, so save the sizes of all the columns at the left
                        currentColumn = this.s.mouse.resizeElem;
                        for(i = previousVisibleColumnIndex; i > 0; i--){
                            if(this.s.dt.aoColumns[i].bVisible){
                                currentColumn = $(currentColumn).prev();
                                this.s.dt.aoColumns[i].sWidth = $(currentColumn).innerWidth() + "px";
                            }
                        }
                    }
                }

                //Update the internal storage of the table's width (in case we changed it because the user resized some column and scrollX was enabled
                //if(scrollXEnabled && $('div.dataTables_scrollHead', this.s.dt.nTableWrapper) != undefined){
                //    if($('div.dataTables_scrollHead', this.s.dt.nTableWrapper).length > 0)
                //        this.table_size = $($('div.dataTables_scrollHead', this.s.dt.nTableWrapper)[0].childNodes[0].childNodes[0]).width();
                //}

                // call resize callback if exists
                if ( this.s.resizeCallback !== null )
                {
                    this.s.resizeCallback.call( this );
                }

                //Save the state
                this.s.dt.oInstance.oApi._fnSaveState( this.s.dt );
            }
            ///////////////////////////////////////////////////////

            this.dom.resize = null;
        },

        /**
         * Calculate a cached array with the points of the column inserts, and the
         * 'to' points
         *  @method  _fnRegions
         *  @returns void
         *  @private
         */
        "_fnRegions": function ()
        {
            var aoColumns = this.s.dt.aoColumns;

            this.s.aoTargets.splice( 0, this.s.aoTargets.length );

            this.s.aoTargets.push( {
                "x":  $(this.s.dt.nTable).offset().left,
                "to": 0
            } );

            var iToPoint = 0;
            for ( var i=0, iLen=aoColumns.length ; i<iLen ; i++ )
            {
                /* For the column / header in question, we want it's position to remain the same if the
                 * position is just to it's immediate left or right, so we only incremement the counter for
                 * other columns
                 */
                if ( i != this.s.mouse.fromIndex )
                {
                    iToPoint++;
                }

                if ( aoColumns[i].bVisible )
                {
                    this.s.aoTargets.push( {
                        "x":  $(aoColumns[i].nTh).offset().left + $(aoColumns[i].nTh).outerWidth(),
                        "to": iToPoint
                    } );
                }
            }

            /* Disallow columns for being reordered by drag and drop, counting right to left */
            if ( this.s.fixedRight !== 0 )
            {
                this.s.aoTargets.splice( this.s.aoTargets.length - this.s.fixedRight );
            }

            /* Disallow columns for being reordered by drag and drop, counting left to right */
            if ( this.s.fixed !== 0 )
            {
                this.s.aoTargets.splice( 0, this.s.fixed );
            }
        },

        /**
         * Copy the TH element that is being drags so the user has the idea that they are actually
         * moving it around the page.
         *  @method  _fnCreateDragNode
         *  @returns void
         *  @private
         */
        "_fnCreateDragNode": function ()
        {
            var scrolling = this.s.dt.oScroll.sX !== "" || this.s.dt.oScroll.sY !== "";

            var origCell = this.s.dt.aoColumns[ this.s.mouse.targetIndex ].nTh;
            var origTr = origCell.parentNode;
            var origThead = origTr.parentNode;
            var origTable = origThead.parentNode;
            var cloneCell = $(origCell).clone();

            // set cursor to move
            $(cloneCell).css({'cursor': 'move'});

            // This is a slightly odd combination of jQuery and DOM, but it is the
            // fastest and least resource intensive way I could think of cloning
            // the table with just a single header cell in it.
            this.dom.drag = $(origTable.cloneNode(false))
                .addClass( 'DTCR_clonedTable' )
                .append(
                    origThead.cloneNode(false).appendChild(
                        origTr.cloneNode(false).appendChild(
                            cloneCell[0]
                        )
                    )
                )
                .css( {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: $(origCell).outerWidth(),
                    height: $(origCell).outerHeight()
                } )
                .appendTo( 'body' );

            this.dom.pointer = $('<div></div>')
                .addClass( 'DTCR_pointer' )
                .css( {
                    position: 'absolute',
                    top: scrolling ?
                        $('div.dataTables_scroll', this.s.dt.nTableWrapper).offset().top :
                        $(this.s.dt.nTable).offset().top,
                    height : scrolling ?
                        $('div.dataTables_scroll', this.s.dt.nTableWrapper).height() :
                        $(this.s.dt.nTable).height()
                } )
                .appendTo( 'body' );
        },

        /**
         * Clean up ColReorder memory references and event handlers
         *  @method  _fnDestroy
         *  @returns void
         *  @private
         */
        "_fnDestroy": function ()
        {
            var i, iLen;

            for ( i=0, iLen=this.s.dt.aoDrawCallback.length ; i<iLen ; i++ )
            {
                if ( this.s.dt.aoDrawCallback[i].sName === 'ColReorder_Pre' )
                {
                    this.s.dt.aoDrawCallback.splice( i, 1 );
                    break;
                }
            }

            $(this.s.dt.nTHead).find( '*' ).off( '.ColReorder' );

            $.each( this.s.dt.aoColumns, function (i, column) {
                $(column.nTh).removeAttr('data-column-index');
            } );

            this.s.dt._colReorder = null;
            this.s = null;
        },

        /**
         * Add a data attribute to the column headers, so we know the index of
         * the row to be reordered. This allows fast detection of the index, and
         * for this plug-in to work with FixedHeader which clones the nodes.
         *  @private
         */
        "_fnSetColumnIndexes": function ()
        {
            var _this = this;
            $.each( this.s.dt.aoColumns, function (i, column) {
                $(column.nTh).attr('data-column-index', i);
                // rebind mouse listener to keep resize event and other references on indices
                _this._fnMouseListener( i, column.nTh );
            } );
        },

        /**
         * Set the table width to auto so that expanding a column will not scrunch other cols
         * It is necessary to set the width first to force it wide enough to scroll, then set to auto so that the cols
         * aren't scrunchable.
         *
         *  @method  _fnDraw
         *  @returns void
         *  @private
         */
        "_fnDraw": function ()
        {
            if (this.s.dt.oFeatures.bAutoWidth === true) {
                if (!this.isOldIE) {
                    $(".dataTables_scrollHead table").width("auto");
                    $(".dataTables_scrollBody table").width("auto");
                }
            }
        }
    };

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Static parameters
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Array of all ColReorder instances for later reference
     *  @property ColReorder.aoInstances
     *  @type     array
     *  @default  []
     *  @static
     */
    ColReorder.aoInstances = [];

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Static functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Reset the column ordering for a DataTables instance
     *  @method  ColReorder.fnReset
     *  @param   object oTable DataTables instance to consider
     *  @returns void
     *  @static
     */
    ColReorder.fnReset = function ( oTable )
    {
        for ( var i=0, iLen=ColReorder.aoInstances.length ; i<iLen ; i++ )
        {
            if ( ColReorder.aoInstances[i].s.dt.oInstance == oTable )
            {
                ColReorder.aoInstances[i].fnReset();
            }
        }
    };

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Constants
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Name of this class
     *  @constant CLASS
     *  @type     String
     *  @default  ColReorder
     */
    ColReorder.prototype.CLASS = "ColReorder";

    /**
     * ColReorder version
     *  @constant  VERSION
     *  @type      String
     *  @default   As code
     */
    ColReorder.VERSION = "1..7";
    ColReorder.prototype.VERSION = ColReorder.VERSION;

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Initialisation
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /*
     * Register a new feature with DataTables
     */
    if ( typeof $.fn.dataTable == "function" &&
        typeof $.fn.dataTableExt.fnVersionCheck == "function" &&
        $.fn.dataTableExt.fnVersionCheck('1.9.3') )
    {
        $.fn.dataTableExt.aoFeatures.push( {
            "fnInit": function( oDTSettings ) {
                var oTable = oDTSettings.oInstance;
                if ( typeof oTable._oPluginColReorder == 'undefined' ) {
                    var opts = typeof oDTSettings.oInit.oColReorder != 'undefined' ?
                        oDTSettings.oInit.oColReorder : {};
                    oTable._oPluginColReorder = new ColReorder( oDTSettings, opts );
                } else {
                    oTable.oApi._fnLog( oDTSettings, 1, "ColReorder attempted to initialise twice. Ignoring second" );
                }

                return null; /* No node to insert */
            },
            "cFeature": "R",
            "sFeature": "ColReorder"
        } );
    }
    else
    {
        alert( "Warning: ColReorder requires DataTables 1.9.3 or greater - www.datatables.net/download");
    }

})(jQuery, window, document);
