{ pkgs, ... }: {
  channel = "stable-23.11";
  packages = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nuclei
    # Dependencias visuales para WeasyPrint
    pkgs.pango
    pkgs.cairo
    pkgs.gdk-pixbuf
    pkgs.glib
    pkgs.libffi
    pkgs.fontconfig
  ];
  
  # Variables de entorno del sistema
  env = {
    LD_LIBRARY_PATH = "${pkgs.lib.makeLibraryPath [
      pkgs.pango
      pkgs.cairo
      pkgs.gdk-pixbuf
      pkgs.glib
      pkgs.libffi
      pkgs.fontconfig
      pkgs.dejavu_fonts
      pkgs.dejavu_fonts 
      pkgs.noto-fonts
      pkgs.fontconfig
    ]}";
  };

  idx = {
    extensions = [
      "ms-python.python"
    ];

    workspace = {
      onCreate = {
        install = "pip install -r requirements.txt";
      };
    };

    # --- ESTA ES LA PARTE NUEVA QUE NECESITABAS ---
    previews = {
      enable = true;
      previews = {
        # Esto fuerza al backend a comportarse como un servidor web público
        backend = {
          command = ["uvicorn" "main:app" "--reload" "--host" "0.0.0.0" "--port" "8000"];
          manager = "web";
          env = {
            PORT = "8000";
          };
        };
      };
    };
    # -----------------------------------------------
  };
}