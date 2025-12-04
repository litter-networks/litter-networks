// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'leaflet/dist/leaflet.css';
import './maps.css';

/* global L */

let mapInstance = null;
let areaLayers = [];
let mapsSourceDomainGlobal = '';

let activeAreaLayer = null;
let frameAreaButton = null;

let activeNetworkLayer = null;
let frameNetworkButton = null;

let networkLayers = [];
let areaInfoGlobal = {};
let currentDarkenOverlay = null;

const polylines = []; // Store all drawn polylines
const polygons = []; // ditto for polygons
const markers = []; // ditto for markers

let snapToPathsEnabled = true;
let showNetworks = true;

const MODE_DEFAULT = '';
const MODE_LOCATION_MARKERS = 'location-markers';
const MODE_LOCATION_DRAW = 'location-draw';

let mode = MODE_DEFAULT;

function validateMode(mode) {
    if (mode?.toLowerCase() === MODE_LOCATION_MARKERS) {
        return MODE_LOCATION_MARKERS;
    }
    else if (mode?.toLowerCase() === MODE_LOCATION_DRAW) {
        return MODE_LOCATION_DRAW;
    }

    return MODE_DEFAULT;
}

function setActiveNetworkLayer(layer) {

    if (activeNetworkLayer == layer) {
        return;
    }

    const highlightClass = 'highlighted-network';

    // Remove the highlight class from the previously active layer
    if (activeNetworkLayer) {
        removeStyleClassFromLayer(activeNetworkLayer, highlightClass);
    }

    if (layer) {
        addStyleClassToLayer(layer, highlightClass);
    }

    activeNetworkLayer = layer;
    updateFrameSelectedNetworkButtonState();
}

function scaleBounds(bounds, scaleFactor) {
    const center = bounds.getCenter();
    const newBounds = L.latLngBounds(
        [
            [
                center.lat + (bounds.getNorth() - center.lat) * scaleFactor,
                center.lng + (bounds.getEast() - center.lng) * scaleFactor
            ],
            [
                center.lat + (bounds.getSouth() - center.lat) * scaleFactor,
                center.lng + (bounds.getWest() - center.lng) * scaleFactor
            ]
        ]
    );

    return newBounds;
}

const ALL_BOUNDS_SCALE = 1.05;
const AREA_BOUNDS_SCALE = 1.05;
const NETWORK_BOUNDS_SCALE = 1.25;

function fitMapToAllBounds(map, bounds, options = {}) {
    if (!map || !bounds) {
        return;
    }
    const scaledBounds = scaleBounds(bounds, ALL_BOUNDS_SCALE);
    map.fitBounds(scaledBounds, { animate: false, ...options });
}

function fitMapToAreaBounds(map, bounds, options = {}) {
    if (!map || !bounds) {
        return;
    }
    const scaledBounds = scaleBounds(bounds, AREA_BOUNDS_SCALE);
    map.fitBounds(scaledBounds, { animate: false, ...options });
}

function fitMapToNetworkBounds(map, bounds, options = {}) {
    if (!map || !bounds) {
        return;
    }
    const scaledBounds = scaleBounds(bounds, NETWORK_BOUNDS_SCALE);
    map.fitBounds(scaledBounds, { animate: false, ...options });
}


function addToggleSnapControl(map) {
    const locateControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size  leaflet-control-frame-all');
            container.innerHTML = '<div>Disable Snap</div>';

            // Add the following styles
            container.style.cursor = 'pointer';
            container.style.userSelect = 'none';

            container.onclick = function () {
                if (snapToPathsEnabled) {
                    snapToPathsEnabled = false;
                    container.innerHTML = '<div>Enable Snap</div>';
                }
                else{
                    snapToPathsEnabled = true;
                    container.innerHTML = '<div>Disable Snap</div>';
                }
            }

            return container;
        }
    });

    map.addControl(new locateControl());
}

function addGeolocationControl(map) {
    const locateControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-locate');
            container.title = 'Show My Location';

            container.onclick = function () {
                map.locate({ setView: true, maxZoom: 16 });
            }

            return container;
        }
    });

    map.addControl(new locateControl());
}

async function fetchGeoJSON(url) {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
    }
    return response.json();
}

function addFrameAllButton(map, allBounds) {
    const frameAllControl = L.Control.extend({
        options: {
            position: 'bottomright' // Position the button in the top-right corner
        },

        onAdd: function (map) {
            // Create the button container
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');
            container.innerHTML = '<div>Frame All</div>';

            // Add the following styles
            container.style.cursor = 'pointer';
            container.style.userSelect = 'none';

            // Add the click event to call fitMapToAllBounds with allBounds
            container.onclick = function (e) {
                fitMapToAllBounds(map, allBounds, { animate: true });
                L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
            };

            return container;
        }
    });

    // Add the new control to the map
    map.addControl(new frameAllControl());
}

function addFrameSelectedAreaButton(map) {
    const frameAreaControl = L.Control.extend({
        options: {
            position: 'bottomright' // Position the button in the top-right corner
        },

        onAdd: function (map) {
            // Create the button container

            frameAreaButton = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');
            frameAreaButton.innerHTML = '<div>Frame Area</div>';

            // Add the following styles
            frameAreaButton.style.cursor = 'pointer';
            frameAreaButton.style.userSelect = 'none';

            // Add the click event to call fitMapToAreaBounds with area-bounds
            frameAreaButton.onclick = function (e) {
                if (activeAreaLayer)
                    fitMapToAreaBounds(map, activeAreaLayer.getBounds(), { animate: true });
                L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
            };

            updateFrameSelectedAreaButtonState();

            return frameAreaButton;
        }
    });

    // Add the new control to the map
    map.addControl(new frameAreaControl());
}

function updateFrameSelectedAreaButtonState() {
    if (!frameAreaButton) {
        return;
    }

    if (activeAreaLayer) {
        frameAreaButton.style.opacity = "1.0";
        frameAreaButton.style.pointerEvents = 'auto';
    } else {
        frameAreaButton.style.opacity = "0.6";
        frameAreaButton.style.pointerEvents = 'none';
    }
}

function addFrameSelectedNetworkButton(map) {
    const frameNetworkControl = L.Control.extend({
        options: {
            position: 'bottomright' // Position the button in the top-right corner
        },

        onAdd: function (map) {
            // Create the button container

            frameNetworkButton = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');
            frameNetworkButton.innerHTML = '<div>Frame Network</div>';

            // Add the following styles
            frameNetworkButton.style.cursor = 'pointer';
            frameNetworkButton.style.userSelect = 'none';

            // Add the click event to call fitMapToNetworkBounds with network-bounds
            frameNetworkButton.onclick = function (e) {
                if (activeNetworkLayer)
                    fitMapToNetworkBounds(map, activeNetworkLayer.getBounds(), { animate: true });
                L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
            };

            updateFrameSelectedNetworkButtonState();

            return frameNetworkButton;
        }
    });

    // Add the new control to the map
    map.addControl(new frameNetworkControl());
}

function updateFrameSelectedNetworkButtonState() {
    if (!frameNetworkButton) {
        return;
    }

    if (activeNetworkLayer) {
        frameNetworkButton.style.opacity = "1.0";
        frameNetworkButton.style.pointerEvents = 'auto';
    } else {
        frameNetworkButton.style.opacity = "0.6";
        frameNetworkButton.style.pointerEvents = 'none';
    }
}

async function addGeoJSONLayers(map, areaInfo, mapsSourceDomain, showNetworks) {
    try {
        const geojsonData = await fetchAllGeoJSON(areaInfo, mapsSourceDomain);
        const { allBounds, layers } = createLayers(geojsonData, areaInfo, map, mapsSourceDomain, showNetworks);
        fitMapToAllBounds(map, allBounds);
        document.getElementById('map').style.display = 'block';

        if (mode === MODE_DEFAULT) {
            // Add the "Frame *" buttons
            addFrameAllButton(map, allBounds);

            if (showNetworks) {
                addFrameSelectedAreaButton(map);
                addFrameSelectedNetworkButton(map);
            }
        }

        return layers;
    } catch (error) {
        console.error('Error fetching GeoJSON files:', error);
    }
}

async function fetchAllGeoJSON(areaInfo, mapsSourceDomain) {
    const geojsonPromises = areaInfo.map(area => 
        fetchGeoJSON(`${mapsSourceDomain}/maps/areas/${area["mapName"]}.json`)
    );
    return Promise.all(geojsonPromises);
}

function createLayers(geojsonData, areaInfo, map, mapsSourceDomain, showNetworks) {
    const allBounds = L.latLngBounds();
    const layers = [];

    geojsonData.forEach((data, index) => {
        const colorClass = areaInfo[index]["mapStyle"];
        const uniqueId = areaInfo[index]["uniqueId"];
        const layer = createLayer(data, colorClass, uniqueId);

        if (mode === MODE_DEFAULT) {
            // Add click and double-click event listeners
            if (showNetworks) {
                addAreaClickEventListener(layer, areaInfo, map, colorClass, mapsSourceDomain);
            }

            addAreaDoubleClickEventListener(layer, map);
        }

        allBounds.extend(layer.getBounds());
        layers.push(layer);
        layer.addTo(map);
    });

    return { allBounds, layers };
}

function geometryHasFilledSurface(geometry) {
    if (!geometry) {
        return false;
    }
    const type = geometry.type;
    if (type === 'Polygon' || type === 'MultiPolygon') {
        return true;
    }
    if (type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
        return geometry.geometries.some(child => geometryHasFilledSurface(child));
    }
    return false;
}

function createLayer(geoJSONData, colorClass, uniqueId) {

    const layer = L.geoJSON(geoJSONData, {
        style: function (feature) {
            const shouldFill = geometryHasFilledSurface(feature.geometry);
            let style = { className: shouldFill ? colorClass : colorClass + "-nofill" };

            if (mode !== MODE_DEFAULT) {
                // Make the layer invisible (but still present)
                style = {
                    opacity: 0,          // Line stroke visibility
                    fillOpacity: 0,      // Fill visibility
                    interactive: false,  // Prevent user interaction (optional)
                    className: ""        // Remove classes if desired
                };
            }

            return style;
        }
    });

    layer.originalStyle = colorClass;

    layer.uniqueId = uniqueId;
    return layer;
}

function addAreaClickEventListener(layer, areaInfo, map, colorClass, mapsSourceDomain) {
    layer.on('click', function (e) {
        L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
        handleAreaLayerClick(layer, areaInfo, map, colorClass, mapsSourceDomain, e);
    });
}

function deselectAllLayers(map, e) {

    if (activeAreaLayer) {

        setActiveNetworkLayer(null);

        // Restore the style of the previously active layer
        activeAreaLayer.setStyle({ className: activeAreaLayer.originalStyle });
        removeNetworkLayers(map);

        activeAreaLayer = null;

        updateFrameSelectedAreaButtonState();
    }

    if (currentDarkenOverlay) {
        map.removeLayer(currentDarkenOverlay);
    }

    setActiveNetworkLayer(null);

    // Send the uniqueId to the parent page
    sendMessageToParent("", "", e);

    e.originalEvent.stopPropagation();
    e.originalEvent.preventDefault();
}

function handleAreaLayerClick(layer, areaInfo, map, colorClass, mapsSourceDomain, e) {

    e.originalEvent.stopPropagation();
    e.originalEvent.preventDefault();

    if (activeAreaLayer === layer && activeNetworkLayer == null)
        return;

    setActiveNetworkLayer(null);

    if (activeAreaLayer !== layer) {
        if (activeAreaLayer) {
            // Restore the style of the previously active layer
            activeAreaLayer.setStyle({ className: activeAreaLayer.originalStyle });
            removeNetworkLayers(map);
        }

        // Set the clicked area as the new active area
        setActiveLayer(layer, colorClass);
        loadNetworkLayers(layer, areaInfo, mapsSourceDomain, map);
    }

    // Send the uniqueId to the parent page
    if (layer.uniqueId) {
        sendMessageToParent(layer.uniqueId, "", e);
    }
}

function addStyleClassToLayer(layer, className) {
    if (layer instanceof L.LayerGroup) {
        // For a LayerGroup, iterate through each layer in the group
        layer.eachLayer(childLayer => {
            addStyleClassToLayer(childLayer, className); // Recursively apply the class to each child layer
        });
    } else {
        let element = null;

        // Check for different layer types and get the correct element
        if (layer instanceof L.Marker) {
            element = layer._icon;
        } else if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            element = layer._path;
        }

        if (element) {
            element.classList.add(className);
        }
    }
}

function removeStyleClassFromLayer(layer, className) {
    if (layer instanceof L.LayerGroup) {
        // For a LayerGroup, iterate through each layer in the group
        layer.eachLayer(childLayer => {
            removeStyleClassFromLayer(childLayer, className); // Recursively remove the class from each child layer
        });
    } else {
        let element = null;

        // Check for different layer types and get the correct element
        if (layer instanceof L.Marker) {
            element = layer._icon;
        } else if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            element = layer._path;
        }

        if (element) {
            element.classList.remove(className);
        }
    }
}

function handleNetworkLayerClick(layer, areaId, map, e) {

    L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
    e.originalEvent.stopPropagation();
    e.originalEvent.preventDefault();

    // If the clicked layer is already active, do nothing
    if (activeNetworkLayer === layer) return;

    // Set the new active layer

    setActiveNetworkLayer(layer);

    // Send the uniqueId to the parent page
    if (layer.uniqueId) {
        sendMessageToParent(areaId, layer.uniqueId, e);
    }
}

function addAreaDoubleClickEventListener(layer, map) {
    layer.on('dblclick', function (e) {
        if (layer.uniqueId) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
            fitMapToAreaBounds(map, layer.getBounds(), { animate: true });
        }
    });
}

function setActiveLayer(layer, colorClass) {
    activeAreaLayer = layer;
    activeAreaLayer.originalStyle = colorClass; // Store the original style
    activeAreaLayer.setStyle({ className: 'no-fill' }); // Set no fill

    updateFrameSelectedAreaButtonState();

    if (layer instanceof L.LayerGroup && (mode === MODE_DEFAULT)) {
        applyInverseOverlay(layer._map, layer);
    }
}

function applyInverseOverlay(map, layerGroup) {
    // Remove existing overlay if it exists
    if (currentDarkenOverlay) {
        map.removeLayer(currentDarkenOverlay);
    }

    // Define the outer ring covering the entire world
    const outerRing = [
        [90, -180],
        [90, 180],
        [-90, 180],
        [-90, -180],
        [90, -180]
    ];

    const holes = [];

    // Collect latLngs for all polygons in the LayerGroup
    layerGroup.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            const latLngs = layer.getLatLngs();

            // Flatten the latLngs to an array of linear rings
            const linearRings = flattenLatLngsToRings(latLngs);

            // Add the linear rings as holes
            holes.push(...linearRings);
        }
    });

    if (holes.length === 0) {
        console.error("No valid LatLng data found in the LayerGroup.");
        return;
    }

    // Create the polygon with holes
    const polygonLatLngs = [outerRing, ...holes];

    const inversePolygon = L.polygon(polygonLatLngs, {
        color: null,
        fillColor: 'rgba(0, 0, 0, 0.8)',
        fillOpacity: 0.8,
        stroke: false,
        interactive: false // Make it non-interactive, so doesn't block selection of other areas/networks
    });

    inversePolygon.addTo(map);

    // Store the overlay
    currentDarkenOverlay = inversePolygon;
}

// Function to flatten latLngs to an array of linear rings
function flattenLatLngsToRings(latLngs) {
    const rings = [];

    function processLatLngs(latLngs) {
        if (Array.isArray(latLngs) && latLngs.length > 0) {
            if (Array.isArray(latLngs[0]) && typeof latLngs[0][0] !== 'number') {
                // It's an array of arrays, recurse
                latLngs.forEach(innerLatLngs => {
                    processLatLngs(innerLatLngs);
                });
            } else {
                // It's a linear ring, add to rings
                rings.push(latLngs);
            }
        }
    }

    processLatLngs(latLngs);

    return rings;
}


function removeNetworkLayers(map) {
    networkLayers.forEach(l => map.removeLayer(l));
    networkLayers = [];
}

function addNetworkClickEventListener(layer, areaId, map) {
    layer.on('click', function (e) {
        handleNetworkLayerClick(layer, areaId, map, e);
    });
}

function addNetworkDoubleClickEventListener(layer, map) {
    layer.on('dblclick', function (e) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();

        if (layer.uniqueId) {
            fitMapToNetworkBounds(map, layer.getBounds(), { animate: true });
        }
    });
}

function loadNetworkLayers(layer, areaInfo, mapsSourceDomain, map) {
    const networks = areaInfo.find(a => a.uniqueId === layer.uniqueId).networks;

    // Separate arrays for area-based and line-based layers
    const areaLayers = [];
    const lineLayers = [];
    const fetchPromises = []; // Array to hold all fetch promises

    for (const network of networks) {
        if (!network.mapFile || network.mapFile === '-' || !network.mapFile.toLowerCase().endsWith("json")) {
            if (network.mapSource === "custom") {
                network.mapFile = `${network.uniqueId}.json`;
            } else {
                continue;
            }
        }

        // Tokenize the mapFile by '|'
        const mapFiles = network.mapFile.split('|');

        for (const mapFile of mapFiles) {
            const networkUrl = `${mapsSourceDomain}/maps/${network.mapSource}/${mapFile}`;

            // Fetch GeoJSON once and classify, and add the promise to the array
            const fetchPromise = fetchGeoJSON(networkUrl).then(networkData => {
                const isAreaBased = classifyAsAreaBased(networkData);

                // Create the network layer
                const networkLayer = createLayer(networkData, layer.originalStyle, network.uniqueId);
                networkLayers.push(networkLayer);

                // Add to respective layer list based on type
                if (isAreaBased) {
                    areaLayers.push(networkLayer);
                } else {
                    lineLayers.push(networkLayer);
                }

                // Add click and double-click event listeners
                if (mode === MODE_DEFAULT) {
                    addNetworkClickEventListener(networkLayer, layer.uniqueId, map);
                    addNetworkDoubleClickEventListener(networkLayer, map);
                }

            }).catch(err => {
                console.error('Error fetching network GeoJSON:', err);
            });

            // Add each fetch promise to the array
            fetchPromises.push(fetchPromise);
        }
    }

    // Wait for all fetches to complete, then add layers to the map
    return Promise.all(fetchPromises).then(() => {
        // Add all area-based layers first, then line-based layers
        areaLayers.forEach(layerToAdd => layerToAdd.addTo(map));
        lineLayers.forEach(layerToAdd => layerToAdd.addTo(map));
    });
}


// Helper function to classify if a network is area-based
function classifyAsAreaBased(networkData) {
    // Check if all geometries are of type 'Polygon' or 'MultiPolygon'
    if (networkData.type === 'FeatureCollection') {
        return networkData.features.every(feature => {
            return geometryHasFilledSurface(feature.geometry);
        });
    } else if (networkData.type === 'Feature') {
        return geometryHasFilledSurface(networkData.geometry);
    }
    return false;
}


// Function to get district full name by uniqueId
function getDistrictFullName(uniqueId) {
    const district = areaInfoGlobal.find(d => d.uniqueId === uniqueId);
    return district ? district.fullName : null;
}

// Function to get network full name by uniqueId within a district
function getNetworkFullName(districtUniqueId, networkUniqueId) {
    // Find the specific district by uniqueId
    const district = areaInfoGlobal.find(d => d.uniqueId === districtUniqueId);

    // If district exists, find the network within its networks list
    if (district) {
        const network = district.networks.find(n => n.uniqueId === networkUniqueId);
        return network ? network.fullName : null;
    }
    return null;
}

function sendMessageToParent(areaId, networkId, e) {

    window.parent.postMessage({
        type: 'layerClick',
        data: {
            areaId: areaId,
            areaFullName: getDistrictFullName(areaId),
            networkId: networkId,
            networkFullName: getNetworkFullName(areaId, networkId),
            lat: e.latlng.lat,
            lng: e.latlng.lng
        }
    }, '*'); // Replace '*' with a specific domain for security if needed
}

let selectionTimeout;
let tempLayer;

function enterStreetViewSelectionMode(map, controlContainer) {
    // Grey out the Street View control by setting opacity to 0.6
    controlContainer.style.opacity = "0.6";

    // Create a full-coverage transparent rectangle layer on top
    const bounds = map.getBounds();
    tempLayer = L.rectangle(bounds, {
        color: '#ffffff',
        weight: 0,
        opacity: 0,      // Invisible border
        fillOpacity: 0,  // Fully transparent fill
        interactive: true // Allows it to capture events
    }).addTo(map);

    // Define a click handler for selecting a location on the temporary layer
    tempLayer.on('click', (e) => {
        // Open Street View at the clicked location
        openStreetViewAtLocation(e.latlng);
        exitStreetViewSelectionMode(map, controlContainer); // Exit selection mode
        L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
    });

    // Set a 5-second timeout to exit selection mode if no location is chosen
    selectionTimeout = setTimeout(() => {
        exitStreetViewSelectionMode(map, controlContainer); // Exit without opening Street View
    }, 5000);
}

// Function to remove the temporary layer and clear the timeout
function exitStreetViewSelectionMode(map, controlContainer) {
    if (tempLayer) {
        map.removeLayer(tempLayer); // Remove the temporary layer
        tempLayer = null;
    }
    // Reset the control's opacity
    controlContainer.style.opacity = "1.0";
    clearTimeout(selectionTimeout); // Clear the timeout
}

function openStreetViewAtLocation(latlng) {
    const lat = latlng.lat;
    const lng = latlng.lng;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`, '_blank');
}

function addStreetViewControl(map) {
    const streetViewControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');
            container.title = 'Select Location for Street View';

            // Add the text or icon for Street View
            container.innerHTML = '<div>Street View</div>';

            // Add the following styles
            container.style.cursor = 'pointer';
            container.style.userSelect = 'none';

            // Set up the click event to enter Street View selection mode
            container.onclick = function (e) {
                enterStreetViewSelectionMode(map, container);
                L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
            }

            return container;
        }
    });

    map.addControl(new streetViewControl());
}


function initMarkersSystem(map, mapsSourceDomain) {
    const customIcon = L.icon({
        iconUrl: mapsSourceDomain + '/images/maps/location-marker.png',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });

    map.on('click', function (e) {
        const marker = L.marker(e.latlng, { icon: customIcon, draggable: true }).addTo(map);
        markers.push(marker);

        notifyUserDataChanged();

        // Remove marker on click
        marker.on('click', function () {
            map.removeLayer(marker);
            const index = markers.indexOf(marker);
            if (index > -1) {
                markers.splice(index, 1);

                notifyUserDataChanged();
            }
        });
    });
}

function initDrawSystem(map) {
    let isDrawing = false; // Track whether drawing is in progress
    let currentPolyline = null; // Reference to the current polyline being drawn
    let spacePressed = false; // Track if the spacebar is pressed
    const activePointers = new Set(); // Track active pointer IDs
    let drawingTimeout = null; // Timeout before starting drawing for touch
    const drawingDelay = 200; // Delay in milliseconds before starting drawing

    map.dragging.disable(); // Disable map dragging initially

    // Detect spacebar state for desktop users
    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !spacePressed) {
            spacePressed = true;
            e.preventDefault(); // Prevent default spacebar behavior (e.g., page scrolling)
            map.dragging.enable(); // Enable map dragging when spacebar is pressed
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'Space' && spacePressed) {
            spacePressed = false;
            map.dragging.disable(); // Disable map dragging when spacebar is released
        }
    });

    // Attach event listeners to the map container
    const container = map.getContainer();

    // Set touch-action to 'none' to prevent default touch behaviors
    container.style.touchAction = 'none';

    container.addEventListener('pointerdown', function (e) {
        activePointers.add(e.pointerId); // Add the pointer ID to the set

        // If spacebar is pressed, allow panning and do not initiate drawing
        if (spacePressed) {
            return;
        }

        const isTouch = e.pointerType === 'touch';
        const isMouse = e.pointerType === 'mouse';

        if (isTouch) {
            if (activePointers.size > 1) {
                // Multitouch detected, enable dragging and prevent drawing
                map.dragging.enable();
                isDrawing = false;
                if (drawingTimeout) {
                    clearTimeout(drawingTimeout);
                    drawingTimeout = null;
                }
                return;
            } else {
                // Single-touch detected, disable dragging
                map.dragging.disable();
                e.preventDefault(); // Prevent default touch behavior (e.g., scrolling)

                // Set a timeout before starting to draw
                drawingTimeout = setTimeout(function () {
                    if (activePointers.size === 1 && !isDrawing) {
                        startDrawing(e);
                    }
                    drawingTimeout = null;
                }, drawingDelay);
            }
        } else if (isMouse) {
            // For mouse events, start drawing on left-click
            if (e.button !== 0) {
                return; // Only proceed on left mouse button
            }
            map.dragging.disable();
            startDrawing(e);
        } else {
            // For other pointer types (e.g., pen), you can handle them as needed
            return;
        }
    });

    // Create a custom pane for the drawing layer
    map.createPane('drawingPane');
    map.getPane('drawingPane').style.opacity = 0.5; // Set the desired opacity
    map.getPane('drawingPane').style.zIndex = 650;  // Adjust z-index as needed

    function startDrawing(e) {
        // Start drawing a new polyline
        isDrawing = true;

        // Create a new polyline and add the starting point
        currentPolyline = L.polyline([map.mouseEventToLatLng(e)], {
            pane: 'drawingPane', // Specify the custom pane
            color: 'blue',
            opacity: 1,
            weight: 8,        // Thickness of the line
            lineCap: 'round', // Round line ends
            interactive: true, // Make the polyline interactive
        }).addTo(map);

        // Mark the polyline as currently being drawn
        currentPolyline.drawing = true;

        // Set touch-action: auto on the polyline's path element
        if (currentPolyline._path) {
            currentPolyline._path.style.touchAction = 'auto';
        }
    }

    container.addEventListener('pointermove', function (e) {
        if (!isDrawing || !currentPolyline) {
            return;
        }

        const isTouch = e.pointerType === 'touch';
        const isMouse = e.pointerType === 'mouse';

        if (isTouch) {
            if (activePointers.size === 1 && activePointers.has(e.pointerId)) {
                e.preventDefault(); // Prevent default touch behavior like scrolling
                // Add new points to the polyline as the pointer moves
                currentPolyline.addLatLng(map.mouseEventToLatLng(e));
            }
        } else if (isMouse) {
            // Add new points to the polyline as the mouse moves
            currentPolyline.addLatLng(map.mouseEventToLatLng(e));
        }
    });

    function handlePointerEnd(e) {
        activePointers.delete(e.pointerId); // Remove the pointer ID from the set

        const isTouch = e.pointerType === 'touch';
        const isMouse = e.pointerType === 'mouse';

        if (isTouch) {
            e.preventDefault(); // Prevent default touch behavior like scrolling

            if (drawingTimeout) {
                clearTimeout(drawingTimeout);
                drawingTimeout = null;
            }

            if (isDrawing && activePointers.size === 0) {
                finalizeDrawing();
            }

            // Disable dragging when no touch points are active
            if (activePointers.size === 0 && !spacePressed) {
                map.dragging.disable();
            }
        } else if (isMouse) {
            if (isDrawing) {
                finalizeDrawing();
            }
            // For mouse, re-enable dragging if needed
            if (!spacePressed) {
                map.dragging.disable();
            }
        }
    };

    // Attach the same handler to both pointerup and pointerleave
    container.addEventListener('pointerup', handlePointerEnd);
    container.addEventListener('pointerleave', handlePointerEnd);

    // Also handle pointercancel to clean up pointers when the event is canceled
    container.addEventListener('pointercancel', function (e) {
        activePointers.delete(e.pointerId);
        if (drawingTimeout) {
            clearTimeout(drawingTimeout);
            drawingTimeout = null;
        }
        if (isDrawing && activePointers.size === 0) {
            finalizeDrawing();
        }
    });

    // Helper function to determine if all points in the polyline are within N pixels of a reference point
    function areAllPointsWithinPixelThreshold(map, latLngs, thresholdPixels = 20) {
        if (latLngs.length === 0) return false;

        // Convert all LatLng points to pixel coordinates
        const pixelPoints = latLngs.map(latlng => map.latLngToContainerPoint(latlng));

        // Use the first pixel point as the reference
        const referencePoint = pixelPoints[0];

        // Function to calculate Euclidean distance between two points
        const distance = (p1, p2) => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Check if every point is within the threshold distance from the reference point
        for (let i = 1; i < pixelPoints.length; i++) {
            if (distance(referencePoint, pixelPoints[i]) > thresholdPixels) {
                return false; // Early exit if any point exceeds the threshold
            }
        }

        return true;
    }

    function finalizeDrawing() {
        isDrawing = false;

        if (currentPolyline) {
            currentPolyline.drawing = false; // Mark drawing as complete

            // Check if all points are within 2 meters of each other, if so then delete the line
            const latLngs = currentPolyline.getLatLngs();
            const withinThreshold = areAllPointsWithinPixelThreshold(map, latLngs);
            if (withinThreshold) {
                map.removeLayer(currentPolyline);
            }
            else {
                // ... otherwise we're good to proceed - simplify the polyline to reduce the number of points
                simplifyPolyline(currentPolyline);

                // Store the new polyline in the array
                polylines.push(currentPolyline);

                // Fire event with updated polyline data
                notifyUserDataChanged();
            }
        }
        currentPolyline = null; // Clear the reference to the current polyline
    }

    // Create an invisible pane around the polyline for easier clicking
    function createInvisiblePane(geometry) {
        const invisiblePaneWeight = 20; // Adjust to set the clickable area size
        const latLngs = geometry.getLatLngs(); // Get the coordinates of the geometry
        const options = {
            pane: 'drawingPane', // Specify the custom pane
            weight: invisiblePaneWeight, // Larger clickable area for polyline
            opacity: 0, // Fully transparent
            interactive: true, // Still interactable
        };

        // Determine if the geometry is a polyline or a polygon
        const invisiblePane =
            geometry instanceof L.Polygon
                ? L.polygon(latLngs, options)
                : L.polyline(latLngs, options);

        // Add to the map
        invisiblePane.addTo(map);

        // Add a click event to the invisible pane
        invisiblePane.on('click', function (e) {
            e.originalEvent.preventDefault(); // Prevent default behavior
            L.DomEvent.stopPropagation(e); // Stop the event from propagating

            // Remove both the geometry and its invisible pane
            map.removeLayer(geometry);
            map.removeLayer(invisiblePane);

            // Remove the geometry from the corresponding array
            const collection = geometry instanceof L.Polygon ? polygons : polylines;
            const index = collection.indexOf(geometry);
            if (index > -1) {
                collection.splice(index, 1);
            }

            // Fire event with updated polyline or polygon data
            notifyUserDataChanged();
        });

        // Store the invisible pane if needed for future reference
        geometry.invisiblePane = invisiblePane;
    }

    function simplifyPolyline(polyline) {
        const tolerance = 10; // Adjust tolerance as needed (in meters)

        // Retrieve the original latlngs of the polyline
        let latlngs = polyline.getLatLngs();

        // Flatten the latlngs array if it's nested
        latlngs = L.LineUtil.isFlat(latlngs) ? latlngs : latlngs[0];

        // Simplify the latlngs using a distance-based approach
        const simplifiedLatLngs = simplifyLatLngs(latlngs, tolerance);

        // Update the polyline with the simplified points
        polyline.setLatLngs(simplifiedLatLngs);

        snapPolylineToFootpaths(polyline)
            .finally(() => {
                createInvisiblePane(polyline); // Add an invisible interactive pane for easier deletion

                detectClosedPolyline(polyline._map, polyline);
        });
    }

    /**
     * Simplify an array of Leaflet LatLng points using distance-based tolerance.
     * @param {LatLng[]} latlngs - The original LatLng points.
     * @param {number} tolerance - Tolerance in meters.
     * @returns {LatLng[]} - Simplified LatLng points.
     */
    function simplifyLatLngs(latlngs, tolerance) {
        const simplified = [];
        let prevLatLng = latlngs[0];
        simplified.push(prevLatLng);

        for (let i = 1; i < latlngs.length; i++) {
            const currentLatLng = latlngs[i];

            // Calculate distance between the current point and the previous point
            const distance = prevLatLng.distanceTo(currentLatLng);

            // Add the point only if it exceeds the tolerance
            if (distance >= tolerance) {
                simplified.push(currentLatLng);
                prevLatLng = currentLatLng;
            }
        }

        return simplified;
    }

    // New function to call OpenRouteService
    async function snapPolylineToFootpaths(polyline) {

        if (!snapToPathsEnabled) {
            return;
        }

        // Retrieve the original latlngs of the polyline
        let latlngs = polyline.getLatLngs();

        // Flatten the latlngs array if it's nested
        latlngs = L.LineUtil.isFlat(latlngs) ? latlngs : latlngs[0];

        // Construct the coordinates array for the Snap API
        const coordinates = latlngs.map(latlng => [latlng.lng, latlng.lat]);

        try {
            // Build the request payload
            const requestBody = {
                locations: coordinates
            };

            const response = await fetch('/api/maps/snap-route', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            const responseBody = await response.text();

            // Check if the response is successful
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText || 'Unknown error'}`);
            }

            // Parse the response body
            const data = JSON.parse(responseBody);

            // Ensure the response contains locations
            if (!data.locations || data.locations.length === 0) {
                throw new Error('No snapped locations found in the API response.');

            }
            // Adjust the snapped locations to remove temporary deviations
            const adjustedLocations = adjustSnappedLocations(data.locations);

            // Extract the snapped coordinates
            const snappedLatLngs = adjustedLocations.map(point => L.latLng(point.location[1], point.location[0]));


            // Update the polyline with the snapped points
            polyline.setLatLngs(snappedLatLngs);

        } catch (error) {
            console.error('Error snapping polyline to footpaths:', error);
        }
    }

    // Function to adjust the snapped locations based on temporary deviations
    function adjustSnappedLocations(locations) {
        const adjustedLocations = [];
        let i = 0;

        while (i < locations.length) {
            const currentName = locations[i].name;
            let j = i + 1;

            // Find the end of the current 'name' sequence
            while (j < locations.length && locations[j].name === currentName) {
                j++;
            }

            // Now, we have a sequence from index i to j - 1 with the same 'name'
            const sequenceLength = j - i;

            // Determine previous and next names for comparison
            const previousName = i > 0 ? locations[i - 1].name : null;
            const nextName = j < locations.length ? locations[j].name : null;

            // Check if this is a temporary deviation
            if (
                sequenceLength <= 2 && // Sequence is short (1 or 2 points)
                previousName && // There is a previous name to compare
                previousName === nextName && // Previous and next names are the same
                currentName !== previousName // Current name is different
            ) {
                // Skip this sequence as it's a temporary deviation
            } else {
                // Include this sequence in the adjusted locations
                for (let k = i; k < j; k++) {
                    adjustedLocations.push(locations[k]);
                }
            }

            // Move to the next sequence
            i = j;
        }

        return adjustedLocations;
    }

    // Function to calculate the total length of the polyline
    function calculateTotalLength(latlngs) {
        return latlngs.reduce((acc, _, i, arr) => {
            if (i === 0) return acc;
            return acc + arr[i - 1].distanceTo(arr[i]);
        }, 0);
    }

    // Function to collect points within a specified percentage of the polyline's length from the start
    function collectStartSegment(latlngs, totalLength, percentage) {
        const thresholdLength = totalLength * percentage;
        const segment = [];
        let accumulatedLength = 0;

        for (let i = 1; i < latlngs.length; i++) {
            const segmentLength = latlngs[i - 1].distanceTo(latlngs[i]);
            accumulatedLength += segmentLength;
            if (accumulatedLength <= thresholdLength) {
                segment.push(latlngs[i]);
            } else {
                break;
            }
        }

        return segment;
    }

    // Function to collect points within a specified percentage of the polyline's length from the end
    function collectEndSegment(latlngs, totalLength, percentage) {
        const thresholdLength = totalLength * percentage;
        const segment = [];
        let accumulatedLength = 0;

        for (let i = latlngs.length - 1; i > 0; i--) {
            const segmentLength = latlngs[i].distanceTo(latlngs[i - 1]);
            accumulatedLength += segmentLength;
            if (accumulatedLength <= thresholdLength) {
                segment.push(latlngs[i - 1]);
            } else {
                break;
            }
        }

        return segment;
    }

    // Function to check if the polyline crosses itself within 10% of both the start and end
    function isPolylineClosed(polyline, percentage = 0.1, tolerance = 50) {
        const latlngs = polyline.getLatLngs();
        const totalLength = calculateTotalLength(latlngs);

        // Collect points within the specified percentage from the start and end
        const startSegment = collectStartSegment(latlngs, totalLength, percentage);
        const endSegment = collectEndSegment(latlngs, totalLength, percentage);

        // Check for crossings between start and end segments
        for (const startPoint of startSegment) {
            for (const endPoint of endSegment) {
                if (startPoint.distanceTo(endPoint) <= tolerance) {
                    return {
                        isClosed: true,
                        crossingPoint: endPoint,
                    };
                }
            }
        }

        // Additionally, check if the polyline is explicitly closed by comparing first and last points
        const firstPoint = latlngs[0];
        const lastPoint = latlngs[latlngs.length - 1];
        if (firstPoint.distanceTo(lastPoint) <= tolerance) {
            return {
                isClosed: true,
                crossingPoint: lastPoint,
            };
        }

        return { isClosed: false };
    }

    // Function to find the index of the crossing point
    function findCrossingIndex(polyline, crossingPoint) {
        const latlngs = polyline.getLatLngs();
        for (let i = 0; i < latlngs.length; i++) {
            if (latlngs[i].equals(crossingPoint)) {
                return i;
            }
        }
        return null;
    }

    // Function to convert the polyline to a filled polygon by retaining the middle 80%
    function convertToPolygon(polyline, map, crossingIndex, percentage) {
        const latlngs = polyline.getLatLngs();
        const totalLength = calculateTotalLength(latlngs);
        const pruneLength = totalLength * percentage;

        let startKeepIndex = 0;
        let accumulatedLength = 0;

        // Determine the index to start keeping the polyline (remove first 10%)
        for (let i = 1; i < latlngs.length; i++) {
            const segmentLength = latlngs[i - 1].distanceTo(latlngs[i]);
            accumulatedLength += segmentLength;
            if (accumulatedLength >= pruneLength) {
                startKeepIndex = i;
                break;
            }
        }

        let endKeepIndex = latlngs.length - 1;
        accumulatedLength = 0;

        // Determine the index to stop keeping the polyline (remove last 10%)
        for (let i = latlngs.length - 1; i > 0; i--) {
            const segmentLength = latlngs[i].distanceTo(latlngs[i - 1]);
            accumulatedLength += segmentLength;
            if (accumulatedLength >= pruneLength) {
                endKeepIndex = i - 1;
                break;
            }
        }

        // Slice the latlngs to retain the middle 80%
        const trimmedLatLngs = latlngs.slice(startKeepIndex, endKeepIndex + 1);

        // Retrieve the crossing point
        const crossingPoint = latlngs[crossingIndex];

        // Add the crossing point at the beginning if it's not already the first point
        if (!trimmedLatLngs[0].equals(crossingPoint)) {
            trimmedLatLngs.unshift(crossingPoint);
        }

        // Add the crossing point at the end if it's not already the last point
        if (!trimmedLatLngs[trimmedLatLngs.length - 1].equals(crossingPoint)) {
            trimmedLatLngs.push(crossingPoint);
        }

        // Create a polygon with the trimmed latlngs
        const polygon = L.polygon(trimmedLatLngs, {
            pane: 'drawingPane',
            color: 'blue', // Border color
            fillColor: 'blue', // Fill color matches the border
            lineCap: 'round', // Rounded line ends
            weight: 8, // thick edge lines
            interactive: true, // Interactive polygon
            fillOpacity: 1, // Fully opaque fill
            opacity: 1 // Fully opaque border
        });

        polygon.addTo(map);

        // Remove the original polyline
        map.removeLayer(polyline);

        const index = polylines.indexOf(polyline);
        if (index > -1) {
            polylines.splice(index, 1);
        }

        createInvisiblePane(polygon); // Add an invisible interactive pane for easier deletion

        // Store the new polyline in the array
        polygons.push(polygon);

        // Fire event with updated polyline data
        notifyUserDataChanged();

        return polygon;
    }

    function getPolylineCentroid(polyline) {
        const latLngs = polyline.getLatLngs(); // Get the LatLng points of the polyline
        let totalLat = 0;
        let totalLng = 0;

        latLngs.forEach((latLng) => {
            totalLat += latLng.lat;
            totalLng += latLng.lng;
        });

        const numPoints = latLngs.length;
        const centerLat = totalLat / numPoints;
        const centerLng = totalLng / numPoints;

        return L.latLng(centerLat, centerLng); // Return as a Leaflet LatLng object
    }

    // Main logic to detect and handle closed polylines
    function detectClosedPolyline(map, polyline, percentage = 0.1, tolerance = 50) {
        const { isClosed, crossingPoint } = isPolylineClosed(polyline, percentage, tolerance);

        if (!isClosed) return;

        const crossingIndex = findCrossingIndex(polyline, crossingPoint);
        if (crossingIndex === null) return;

        // Add a button at the crossing point to allow manual conversion if needed

        const buttonDiv = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');
        buttonDiv.innerHTML = 'Make Area';
        buttonDiv.style.position = 'absolute';
        buttonDiv.style.width = '6em';

        const centroid = getPolylineCentroid(polyline);
        const endPixel = map.latLngToContainerPoint(centroid);

        // Adjust for centering
        const buttonWidth = 90; // Width of the element
        const buttonHeight = -20; // Height of the element

        // Set styles to center the element on the centroid
        buttonDiv.style.left = `${endPixel.x - buttonWidth / 2}px`;
        buttonDiv.style.top = `${endPixel.y - buttonHeight / 2}px`;

        // Append the button to the map's container to ensure it's part of the map's DOM hierarchy
        map.getContainer().appendChild(buttonDiv);

        // Define the function to handle map clicks
        const onMapClick = () => {
            if (map.hasLayer(polyline)) { // Optional: Check if polyline is still on the map
                map.getContainer().removeChild(buttonDiv);
                map.getContainer().removeEventListener('pointerdown', onMapClick); // Remove the click listener after removing the button
            }
        };

        // Add a click event listener to the map
        map.getContainer().addEventListener('pointerdown', onMapClick);

        // Prevent clicks on the button from propagating to the map
        L.DomEvent.on(buttonDiv, 'pointerdown', (e) => {
            L.DomEvent.stopPropagation(e); // Stop the click from reaching the map's listener
            convertToPolygon(polyline, map, crossingIndex, percentage);
            map.getContainer().removeChild(buttonDiv);
            map.getContainer().removeEventListener('pointerdown', onMapClick); // Remove the map click listener after removing the button
        });
    }
}

function initMapTilesWithToggle(map) {
    // Define the base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '<a href="http://www.litternetworks.org">Litter Networks</a> | Map &copy; OpenStreetMap contributors'
    });

    // ESRI World Imagery Layer
    const esriWorldImagery = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '<a href="http://www.litternetworks.org">Litter Networks</a> | Map &copy; Esri',
        subdomains: ['server', 'services']
    });

    // ESRI World Transportation Layer (for roads and street names)
    const esriWorldTransportation = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        subdomains: ['server', 'services']
    });

    // ESRI World Boundaries and Places Layer (for political boundaries and place names)
    const esriWorldBoundariesAndPlaces = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        subdomains: ['server', 'services']
    });

    // Add OpenStreetMap layer as the initial layer
    osmLayer.addTo(map);

    // Create a button for toggling layers
    const toggleButton = L.control({ position: 'bottomleft' });

    toggleButton.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-size leaflet-control-frame-all');

        div.innerHTML = '<div>Satellite View</div>';

        // Add the following styles
        div.style.cursor = 'pointer';
        div.style.userSelect = 'none';

        div.onclick = function (e) {
            const mapContainer = document.getElementById('map');

            if (map.hasLayer(osmLayer)) {
                map.removeLayer(osmLayer);
                map.addLayer(esriWorldImagery);
                map.addLayer(esriWorldTransportation);
                map.addLayer(esriWorldBoundariesAndPlaces);
                div.innerHTML = '<div>Normal View</div>';
                mapContainer.classList.add('satellite-view-filter');
            } else {
                map.removeLayer(esriWorldImagery);
                map.removeLayer(esriWorldTransportation);
                map.removeLayer(esriWorldBoundariesAndPlaces);
                map.addLayer(osmLayer);
                div.innerHTML = '<div>Satellite View</div>';
                mapContainer.classList.remove('satellite-view-filter');
            }

            L.DomEvent.stopPropagation(e); // Prevents event propagation to the map
        };
        return div;
    };

    // Add the toggle button to the map
    toggleButton.addTo(map);
}

function notifyUserDataChanged() {

    // Prepare the data object using globals
    const data = {
        polylines: polylines.map(polyline => polyline.getLatLngs()), // Extract lat/lng data from each polyline
        polygons: polygons.map(polygon => polygon.getLatLngs()), // Extract lat/lng data from each polygon
        markers: markers.map(marker => marker.getLatLng()), // Extract lat/lng data from each marker
    };

    // Remove empty fields from the data object
    const filteredData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value.length > 0) // Only keep non-empty arrays
    );

    // Convert the filtered data object to JSON
    const jsonData = JSON.stringify(filteredData);

    if (window !== window.parent) {
        window.parent.postMessage({ type: 'user-data-changed', jsonData }, '*');
    }
}


async function applySelection(currentSelection) {
    if (!mapInstance || !currentSelection || !currentSelection.districtId) {
        return;
    }

    const districtId = currentSelection.districtId ? currentSelection.districtId.split(',')[0] : '';
    const districtLayer = areaLayers.find(layer => layer.uniqueId === districtId);
    if (!districtLayer) {
        return;
    }

    // Simulate a click event on the districtLayer
    handleAreaLayerClick(districtLayer, areaInfoGlobal, mapInstance, districtLayer.originalStyle, mapsSourceDomainGlobal, {
        originalEvent: { stopPropagation: () => { }, preventDefault: () => { } },
        latlng: mapInstance.getCenter()
    });

    // If currentSelection.networkId is specified
        if (currentSelection.networkId) {
            removeNetworkLayers(mapInstance);
            await loadNetworkLayers(districtLayer, areaInfoGlobal, mapsSourceDomainGlobal, mapInstance);

        const networkLayer = networkLayers.find(layer => layer.uniqueId === currentSelection.networkId);
        if (networkLayer) {
            if (mode === MODE_DEFAULT) {
                // Simulate a click event on the networkLayer
                handleNetworkLayerClick(networkLayer, districtLayer.uniqueId, mapInstance, {
                    originalEvent: { stopPropagation: () => { }, preventDefault: () => { } },
                    latlng: mapInstance.getCenter()
                });
            }

            fitMapToNetworkBounds(mapInstance, networkLayer.getBounds(), { animate: true, duration: 1 });
        }
    }
}

async function createMap(_mode, mapsSourceDomain, _routesGeoJSONUrl, areaInfo, showNetworksIn, currentSelection = null, modeIn = '' ) {

    mode = validateMode(modeIn);

    showNetworks = showNetworksIn;

    const mapContainer = document.getElementById('map');
    mapContainer.style.opacity = '0'; // Set initial opacity to 0 instantly
    mapContainer.style.transition = 'none'; // Ensure no transition is applied initially

    areaInfoGlobal = areaInfo;

    const map = L.map('map', {
        zoomSnap: 0,
        doubleClickZoom: false,
        zoomControl: false, // Disable the default zoom control
        zoomAnimation: true, // Enable zoom animations
    }).setView([0, 0], 18);

    mapInstance = map;

    addGeolocationControl(map);

    if (mode === MODE_LOCATION_DRAW) {
        addToggleSnapControl(map);
    }

    initMapTilesWithToggle(map);

    // Add the zoom control in the top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    addStreetViewControl(map);

    const layers = await addGeoJSONLayers(map, areaInfo, mapsSourceDomain, showNetworks);

    areaLayers = layers;
    mapsSourceDomainGlobal = mapsSourceDomain;

    map.on('click', function (event) {
        deselectAllLayers(map, event);
    });

    if (mode === MODE_LOCATION_MARKERS) {
        initMarkersSystem(map, mapsSourceDomain);
    }
    else if (mode === MODE_LOCATION_DRAW) {
        initDrawSystem(map);
    }

    // Handle current selection if specified
    if (currentSelection && currentSelection.districtId) {
        await applySelection(currentSelection);
    }

    // After a tiny delay, apply the transition and set opacity to 1
    setTimeout(() => {
        mapContainer.style.transition = 'opacity 0.5s ease'; // Add transition for the fade-in
        mapContainer.style.opacity = '1'; // Trigger the fade-in effect
    }, 10); // 100 ms delay to allow the browser to register the initial state
}

// Check if module.exports is available (Node.js environment)
window.createMap = createMap;
window.fetchGeoJSON = fetchGeoJSON;
window.updateMapSelection = applySelection;
