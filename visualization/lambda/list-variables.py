import json
import boto3
import xarray as xr
import tempfile
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 client
s3 = boto3.client('s3')

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

def extract_variable_metadata(ds):
    """Extract metadata for all variables in the dataset"""
    variables = []
    
    for var_name, var in ds.data_vars.items():
        # Skip variables with fewer than 2 dimensions
        if len(var.dims) < 2:
            continue
        
        # Get basic metadata
        metadata = {
            'name': var_name,
            'dims': list(var.dims),
            'shape': list(var.shape),
            'dtype': str(var.dtype)
        }
        
        # Get attributes
        for attr_name, attr_value in var.attrs.items():
            if attr_name in ['units', 'long_name', 'standard_name', 'description']:
                metadata[attr_name] = str(attr_value)
        
        # Parse species name if applicable
        if var_name.startswith('SpeciesConc_'):
            metadata['species'] = var_name.replace('SpeciesConc_', '')
        elif var_name.startswith('AerosolMass_'):
            metadata['species'] = var_name.replace('AerosolMass_', '')
        
        # Determine variable type based on name patterns
        if var_name.startswith('SpeciesConc_'):
            metadata['type'] = 'concentration'
        elif var_name.startswith('AerosolMass_'):
            metadata['type'] = 'aerosol'
        elif var_name.startswith('Met_'):
            metadata['type'] = 'meteorology'
        elif 'Flux' in var_name:
            metadata['type'] = 'flux'
        elif 'Emis' in var_name:
            metadata['type'] = 'emission'
        else:
            metadata['type'] = 'other'
        
        # Add to variables list
        variables.append(metadata)
    
    return variables

def extract_dimension_info(ds):
    """Extract information about dimensions in the dataset"""
    dimensions = {}
    
    # Time dimension
    if 'time' in ds.dims:
        time_vals = ds['time'].values
        dimensions['time'] = {
            'size': len(time_vals),
            'start': str(time_vals[0]),
            'end': str(time_vals[-1]) if len(time_vals) > 1 else str(time_vals[0])
        }
    
    # Vertical levels
    if 'lev' in ds.dims:
        lev_vals = ds['lev'].values
        dimensions['lev'] = {
            'size': len(lev_vals),
            'min': float(lev_vals.min()),
            'max': float(lev_vals.max())
        }
    
    # Latitude and longitude
    if 'lat' in ds.dims:
        lat_vals = ds['lat'].values
        dimensions['lat'] = {
            'size': len(lat_vals),
            'min': float(lat_vals.min()),
            'max': float(lat_vals.max())
        }
    
    if 'lon' in ds.dims:
        lon_vals = ds['lon'].values
        dimensions['lon'] = {
            'size': len(lon_vals),
            'min': float(lon_vals.min()),
            'max': float(lon_vals.max())
        }
    
    return dimensions

def extract_global_attributes(ds):
    """Extract global attributes from the dataset"""
    global_attrs = {}
    
    for attr_name, attr_value in ds.attrs.items():
        if attr_name in ['title', 'source', 'history', 'references', 'comment']:
            global_attrs[attr_name] = str(attr_value)
    
    return global_attrs

def handler(event, context):
    """Lambda handler for listing variables in a NetCDF file"""
    try:
        # Get parameters from the event
        source_bucket = event['sourceBucket']
        source_key = event['sourceKey']
        
        # Load the NetCDF data
        logger.info(f"Loading NetCDF data from s3://{source_bucket}/{source_key}")
        ds = load_netcdf_from_s3(source_bucket, source_key)
        
        # Extract variable metadata
        variables = extract_variable_metadata(ds)
        
        # Extract dimension information
        dimensions = extract_dimension_info(ds)
        
        # Extract global attributes
        global_attributes = extract_global_attributes(ds)
        
        # Sort variables by name
        variables.sort(key=lambda x: x['name'])
        
        # Group variables by type
        variables_by_type = {}
        for var in variables:
            var_type = var['type']
            if var_type not in variables_by_type:
                variables_by_type[var_type] = []
            variables_by_type[var_type].append(var)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Variables listed successfully',
                'filename': source_key.split('/')[-1],
                'variables': variables,
                'variablesByType': variables_by_type,
                'dimensions': dimensions,
                'globalAttributes': global_attributes,
                'totalVariables': len(variables)
            })
        }
    
    except Exception as e:
        logger.error(f"Error listing variables: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f"Error listing variables: {str(e)}"
            })
        }