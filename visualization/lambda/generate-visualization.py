import json
import os
import boto3
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for Lambda environment
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import xarray as xr
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from datetime import datetime
import tempfile
import uuid
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 client
s3 = boto3.client('s3')

# Default colormap for concentration plots
CMAP_CONCENTRATION = LinearSegmentedColormap.from_list(
    'concentration', 
    ['#FFFFFF', '#FFF7BC', '#FEE391', '#FEC44F', '#FE9929', 
     '#EC7014', '#CC4C02', '#993404', '#662506']
)

def load_netcdf_from_s3(bucket, key):
    """Load a NetCDF file from S3 into an xarray Dataset"""
    try:
        with tempfile.NamedTemporaryFile() as temp_file:
            s3.download_file(bucket, key, temp_file.name)
            ds = xr.open_dataset(temp_file.name)
            return ds
    except Exception as e:
        logger.error(f"Error loading NetCDF file from S3: {e}")
        raise

def parse_variable_name(variable_name):
    """Parse variable name and extract species name if present"""
    if "SpeciesConc_" in variable_name:
        return variable_name.replace("SpeciesConc_", "")
    elif "AerosolMass_" in variable_name:
        return variable_name.replace("AerosolMass_", "")
    else:
        return variable_name

def get_variable_metadata(ds, variable_name):
    """Extract metadata for a variable from the dataset"""
    metadata = {}
    var = ds[variable_name]
    
    # Extract units
    metadata['units'] = getattr(var, 'units', 'unknown')
    
    # Extract long name
    metadata['long_name'] = getattr(var, 'long_name', parse_variable_name(variable_name))
    
    # Extract range
    try:
        if variable_name in ds:
            data = ds[variable_name].values
            if np.isnan(data).all():
                metadata['min'] = 0
                metadata['max'] = 1
            else:
                metadata['min'] = float(np.nanmin(data))
                metadata['max'] = float(np.nanmax(data))
    except Exception as e:
        logger.warning(f"Error getting range for {variable_name}: {e}")
        metadata['min'] = 0
        metadata['max'] = 1
    
    return metadata

def generate_global_map(ds, variable_name, level=0, time_idx=0):
    """Generate a global map visualization for a variable"""
    try:
        # Extract variable and metadata
        var = ds[variable_name]
        var_metadata = get_variable_metadata(ds, variable_name)
        
        # Extract coordinates
        if 'lat' in ds.coords and 'lon' in ds.coords:
            lats = ds['lat'].values
            lons = ds['lon'].values
        elif 'latitude' in ds.coords and 'longitude' in ds.coords:
            lats = ds['latitude'].values
            lons = ds['longitude'].values
        else:
            raise ValueError("Cannot find latitude/longitude coordinates")
        
        # Set up figure with Cartopy projection
        fig = plt.figure(figsize=(12, 8))
        ax = plt.axes(projection=ccrs.Robinson())
        
        # Add map features
        ax.coastlines(linewidth=0.5)
        ax.add_feature(cfeature.BORDERS, linewidth=0.3)
        ax.add_feature(cfeature.STATES, linewidth=0.1)
        
        # Extract data for plotting
        if 'lev' in var.dims:
            if 'time' in var.dims:
                data = var.isel(time=time_idx, lev=level).values
            else:
                data = var.isel(lev=level).values
        else:
            if 'time' in var.dims:
                data = var.isel(time=time_idx).values
            else:
                data = var.values
        
        # Create mesh grid for plotting
        lon_mesh, lat_mesh = np.meshgrid(lons, lats)
        
        # Determine colormap range
        vmin = var_metadata['min']
        vmax = var_metadata['max']
        
        # Handle very small numbers or NaN
        if vmin == vmax or np.isnan(vmin) or np.isnan(vmax):
            vmin = 0
            vmax = 1
        
        # Create plot
        mesh = ax.pcolormesh(
            lon_mesh, lat_mesh, data, 
            transform=ccrs.PlateCarree(), 
            cmap=CMAP_CONCENTRATION,
            vmin=vmin, vmax=vmax
        )
        
        # Add colorbar
        cbar = plt.colorbar(mesh, orientation='horizontal', pad=0.05, aspect=40)
        cbar.set_label(f"{var_metadata['long_name']} ({var_metadata['units']})")
        
        # Add title
        species_name = parse_variable_name(variable_name)
        level_str = f"Level {level}" if 'lev' in var.dims else "Surface"
        time_str = ""
        if 'time' in var.dims and len(ds['time']) > 0:
            time_val = ds['time'].values[time_idx]
            time_str = pd.to_datetime(time_val).strftime('%Y-%m-%d %H:%M')
        
        plt.title(f"{species_name} Concentration - {level_str} - {time_str}")
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(temp_file.name, dpi=150, bbox_inches='tight')
        plt.close(fig)
        
        return temp_file.name
    
    except Exception as e:
        logger.error(f"Error generating global map: {e}")
        raise

def generate_zonal_mean(ds, variable_name, time_idx=0):
    """Generate a zonal mean visualization for a variable"""
    try:
        # Extract variable and metadata
        var = ds[variable_name]
        var_metadata = get_variable_metadata(ds, variable_name)
        
        # Check if the variable has a vertical dimension
        if 'lev' not in var.dims:
            logger.info(f"Variable {variable_name} does not have a vertical dimension")
            return None
        
        # Extract coordinates
        if 'lat' in ds.coords:
            lats = ds['lat'].values
        elif 'latitude' in ds.coords:
            lats = ds['latitude'].values
        else:
            raise ValueError("Cannot find latitude coordinates")
        
        if 'lev' in ds.coords:
            levs = ds['lev'].values
        elif 'levels' in ds.coords:
            levs = ds['levels'].values
        else:
            raise ValueError("Cannot find vertical level coordinates")
        
        # Set up figure
        fig = plt.figure(figsize=(12, 8))
        ax = plt.axes()
        
        # Extract data for plotting
        if 'time' in var.dims:
            data = var.isel(time=time_idx).values
        else:
            data = var.values
        
        # Compute zonal mean if needed
        if 'lon' in var.dims or 'longitude' in var.dims:
            zonal_mean = np.nanmean(data, axis=1)  # Average over longitude
        else:
            zonal_mean = data
        
        # Create mesh grid for plotting
        lat_mesh, lev_mesh = np.meshgrid(lats, levs)
        
        # Determine colormap range
        vmin = var_metadata['min']
        vmax = var_metadata['max']
        
        # Handle very small numbers or NaN
        if vmin == vmax or np.isnan(vmin) or np.isnan(vmax):
            vmin = 0
            vmax = 1
        
        # Create plot
        mesh = ax.pcolormesh(
            lat_mesh, lev_mesh, zonal_mean.T,  # Transpose for proper orientation
            cmap=CMAP_CONCENTRATION,
            vmin=vmin, vmax=vmax
        )
        
        # Reverse Y-axis (pressure decreases with height)
        ax.invert_yaxis()
        
        # Add colorbar
        cbar = plt.colorbar(mesh, orientation='vertical', pad=0.05)
        cbar.set_label(f"{var_metadata['long_name']} ({var_metadata['units']})")
        
        # Add labels
        ax.set_xlabel('Latitude (°)')
        ax.set_ylabel('Pressure (hPa)')
        
        # Add title
        species_name = parse_variable_name(variable_name)
        time_str = ""
        if 'time' in var.dims and len(ds['time']) > 0:
            time_val = ds['time'].values[time_idx]
            time_str = pd.to_datetime(time_val).strftime('%Y-%m-%d %H:%M')
        
        plt.title(f"{species_name} Zonal Mean - {time_str}")
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(temp_file.name, dpi=150, bbox_inches='tight')
        plt.close(fig)
        
        return temp_file.name
    
    except Exception as e:
        logger.error(f"Error generating zonal mean: {e}")
        return None

def generate_time_series(ds, variable_name, level=0, lat_idx=None, lon_idx=None):
    """Generate a time series visualization for a variable at a specific location"""
    try:
        # Extract variable and metadata
        var = ds[variable_name]
        var_metadata = get_variable_metadata(ds, variable_name)
        
        # Check if the variable has a time dimension
        if 'time' not in var.dims:
            logger.info(f"Variable {variable_name} does not have a time dimension")
            return None
        
        # Extract time coordinate
        times = ds['time'].values
        
        # Set up figure
        fig = plt.figure(figsize=(12, 8))
        ax = plt.axes()
        
        # Extract data for plotting
        if lat_idx is not None and lon_idx is not None:
            # Point time series
            if 'lev' in var.dims:
                data = var.isel(lev=level, lat=lat_idx, lon=lon_idx).values
            else:
                data = var.isel(lat=lat_idx, lon=lon_idx).values
                
            # Get location info for title
            lat_val = ds['lat'].values[lat_idx]
            lon_val = ds['lon'].values[lon_idx]
            location_str = f"at {lat_val:.1f}°N, {lon_val:.1f}°E"
        else:
            # Global mean time series
            if 'lev' in var.dims:
                if 'lat' in var.dims and 'lon' in var.dims:
                    data = var.isel(lev=level).mean(dim=['lat', 'lon']).values
                else:
                    data = var.isel(lev=level).mean(dim=['latitude', 'longitude']).values
            else:
                if 'lat' in var.dims and 'lon' in var.dims:
                    data = var.mean(dim=['lat', 'lon']).values
                else:
                    data = var.mean(dim=['latitude', 'longitude']).values
            
            location_str = "Global Mean"
        
        # Plot time series
        ax.plot(times, data, 'b-', linewidth=2)
        
        # Format x-axis as dates
        plt.gcf().autofmt_xdate()
        
        # Add labels
        ax.set_xlabel('Date')
        ax.set_ylabel(f"{var_metadata['long_name']} ({var_metadata['units']})")
        
        # Add title
        species_name = parse_variable_name(variable_name)
        level_str = f"Level {level}" if 'lev' in var.dims else "Surface"
        
        plt.title(f"{species_name} Concentration - {level_str} - {location_str}")
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(temp_file.name, dpi=150, bbox_inches='tight')
        plt.close(fig)
        
        return temp_file.name
    
    except Exception as e:
        logger.error(f"Error generating time series: {e}")
        return None

def handler(event, context):
    """Lambda handler for visualization generation"""
    try:
        # Get parameters from the event
        source_bucket = event['sourceBucket']
        source_key = event['sourceKey']
        output_bucket = event.get('outputBucket', source_bucket)
        output_prefix = event.get('outputPrefix', 'visualizations/')
        variable_name = event.get('variableName')
        viz_type = event.get('visualizationType', 'global_map')
        
        # Optional parameters with defaults
        level = int(event.get('level', 0))
        time_idx = int(event.get('timeIndex', 0))
        lat_idx = event.get('latIndex')
        lon_idx = event.get('lonIndex')
        
        # Convert string indices to integers if provided
        if lat_idx is not None:
            lat_idx = int(lat_idx)
        if lon_idx is not None:
            lon_idx = int(lon_idx)
        
        # Load the NetCDF data
        logger.info(f"Loading NetCDF data from s3://{source_bucket}/{source_key}")
        ds = load_netcdf_from_s3(source_bucket, source_key)
        
        # If no variable specified, use the first data variable
        if not variable_name:
            data_vars = list(ds.data_vars)
            if len(data_vars) == 0:
                raise ValueError("No data variables found in the dataset")
            variable_name = data_vars[0]
            logger.info(f"No variable specified, using: {variable_name}")
        
        # Check if the variable exists
        if variable_name not in ds:
            raise ValueError(f"Variable {variable_name} not found in the dataset")
        
        # Generate visualization based on type
        viz_file = None
        if viz_type == 'global_map':
            viz_file = generate_global_map(ds, variable_name, level=level, time_idx=time_idx)
        elif viz_type == 'zonal_mean':
            viz_file = generate_zonal_mean(ds, variable_name, time_idx=time_idx)
        elif viz_type == 'time_series':
            viz_file = generate_time_series(ds, variable_name, level=level, lat_idx=lat_idx, lon_idx=lon_idx)
        else:
            raise ValueError(f"Unsupported visualization type: {viz_type}")
        
        if viz_file is None:
            raise ValueError(f"Failed to generate visualization for {variable_name}")
        
        # Upload to S3
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_id = str(uuid.uuid4())[:8]
        output_key = f"{output_prefix}{viz_type}_{variable_name}_{timestamp}_{random_id}.png"
        
        with open(viz_file, 'rb') as f:
            s3.put_object(
                Bucket=output_bucket,
                Key=output_key,
                Body=f.read(),
                ContentType='image/png'
            )
        
        # Clean up temporary file
        os.unlink(viz_file)
        
        # Get a presigned URL for the visualization
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': output_bucket, 'Key': output_key},
            ExpiresIn=3600  # URL valid for 1 hour
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Visualization generated successfully',
                'visualizationUrl': presigned_url,
                'bucket': output_bucket,
                'key': output_key,
                'variableName': variable_name,
                'visualizationType': viz_type
            })
        }
    
    except Exception as e:
        logger.error(f"Error in visualization generation: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f"Error generating visualization: {str(e)}"
            })
        }