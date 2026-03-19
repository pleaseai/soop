The codebase is an xarray repository.

Issue: `.swap_dims()` modifies the original object

The `swap_dims` method is supposed to return a new Dataset/DataArray with swapped dimensions, but it currently modifies the original object as a side effect.

```python
import numpy as np
import xarray as xr

nz = 11
ds = xr.Dataset(
    {
        "y": ("z", np.random.rand(nz)),
        "lev": ("z", np.arange(nz) * 10),
    }
)

print(ds["y"])
# <xarray.DataArray 'y' (z: 11)>  <-- dimension is 'z'

ds2 = ds.swap_dims({"z": "lev"})

print(ds["y"])
# <xarray.DataArray 'y' (lev: 11)>  <-- dimension changed to 'lev' in original!
```

After calling `swap_dims`, the original dataset's variable dimensions are mutated. The `swap_dims` method should create copies of variables instead of modifying them in-place.

The issue is that `Variable.to_index_variable()` and `Variable.to_base_variable()` share internal data references with the original variable, and when `swap_dims` sets `.dims` on the result, it also mutates the original.

Your task is to identify and edit the files that need to be modified to resolve the issue. Focus on making the necessary changes to completely address the problem. Use the available tools step by step to accomplish this goal.
