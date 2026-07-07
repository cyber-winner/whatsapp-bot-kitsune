import sys
import re
import sympy
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

# Map of common math names -> SymPy function names
FUNC_ALIASES = {
    'arctan': 'atan',
    'arcsin': 'asin',
    'arccos': 'acos',
    'ln': 'log',
}

# SymPy function names we want to protect from implicit multiplication splitting
SYMPY_FUNCS = ['atan', 'asin', 'acos', 'sin', 'cos', 'tan', 'log', 'abs', 'sqrt', 'exp']

def preprocess(expression_str):
    """Clean up the expression string before parsing."""
    
    # Replace unicode superscripts with ^ notation
    superscripts = {'⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
                    '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9'}
    for uni, repl in superscripts.items():
        expression_str = expression_str.replace(uni, repl)
    
    # Replace common aliases FIRST (arctan -> atan, etc.)
    # Sort by length descending so 'arctan' is replaced before 'tan'
    for alias, sympy_name in sorted(FUNC_ALIASES.items(), key=lambda x: -len(x[0])):
        expression_str = expression_str.replace(alias, sympy_name)
    
    # Handle missing parentheses: sinx -> sin(x), cosx -> cos(x), atanx -> atan(x), etc.
    # Matches: function name followed directly by a variable letter (no parenthesis)
    all_funcs = sorted(SYMPY_FUNCS, key=len, reverse=True)
    for func in all_funcs:
        # e.g. "sinx" -> "sin(x)", "atan2x" stays because 2 is a digit before x
        expression_str = re.sub(
            r'\b' + re.escape(func) + r'([a-zA-Z])(?!\w*\()',
            func + r'(\1)',
            expression_str
        )
    
    # Insert implicit multiplication: e.g. "xatan(x)" -> "x*atan(x)", "2sin(x)" -> "2*sin(x)"
    # We need a NEGATIVE LOOKBEHIND to avoid splitting "atan" into "a*tan"
    # Strategy: temporarily replace known function names with placeholders,
    # do the multiplication insertion, then restore them.
    placeholders = {}
    # Sort funcs by length descending so 'atan' is replaced before 'tan'
    for i, func in enumerate(sorted(SYMPY_FUNCS, key=len, reverse=True)):
        placeholder = f'__FUNC{i}__'
        placeholders[placeholder] = func
        expression_str = expression_str.replace(func, placeholder)
    
    # Now insert multiplication between:
    # - variable/number/closing-paren and a placeholder: "x__FUNC0__" -> "x*__FUNC0__"
    for placeholder in placeholders:
        expression_str = re.sub(
            r'([a-zA-Z0-9\)])(' + re.escape(placeholder) + r')',
            r'\1*\2',
            expression_str
        )
    
    # Restore placeholders back to function names
    for placeholder, func in placeholders.items():
        expression_str = expression_str.replace(placeholder, func)
    
    return expression_str

def solve(operation, expression_str):
    try:
        transformations = standard_transformations + (implicit_multiplication_application, convert_xor)
        
        x, y, z = sympy.symbols('x y z')
        local_dict = {'x': x, 'y': y, 'z': z}
        
        expression_str = preprocess(expression_str)
        
        expr = parse_expr(expression_str, local_dict=local_dict, transformations=transformations, evaluate=False)
        
        if operation == 'simplify':
            result = sympy.simplify(expr)
        elif operation == 'factor':
            result = sympy.factor(expr)
        elif operation == 'derive':
            result = sympy.diff(expr, x)
        elif operation == 'integrate':
            result = sympy.integrate(expr, x)
        elif operation == 'zeroes':
            result = sympy.solve(expr, x)
        elif operation in ['sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'log', 'abs']:
            func_map = {'arcsin': sympy.asin, 'arccos': sympy.acos, 'arctan': sympy.atan}
            func = func_map.get(operation, getattr(sympy, operation))
            result = func(expr)
        else:
            return f"Error: Unknown operation '{operation}'"
            
        return f"VERIFIED RESULT (state this exactly, do not algebraically rearrange): {str(result)}"
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 sympy_solver.py <operation> <expression>")
        sys.exit(1)
        
    operation = sys.argv[1]
    expression = sys.argv[2]
    
    print(solve(operation, expression))
