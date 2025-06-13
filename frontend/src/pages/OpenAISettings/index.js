import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Container from "@material-ui/core/Container";
import MenuItem from "@material-ui/core/MenuItem";
import { toast } from "react-toastify";

import { getOpenAISettings, saveOpenAISettings } from "../../services/openai";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    margin: theme.spacing(1),
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  btnWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
  },
}));

const models = [
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "gpt-4", label: "GPT-4" },
];

const OpenAISettings = () => {
  const classes = useStyles();
  const [settings, setSettings] = useState({
    key: "",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 500,
    systemMessage: "Eres un asistente amable y profesional.",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getOpenAISettings();
      setSettings(data);
    } catch (err) {
      toast.error("Error al cargar la configuración de OpenAI");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parsedValue = name === "temperature" || name === "maxTokens" 
      ? parseFloat(value) 
      : value;
    setSettings((prev) => ({ ...prev, [name]: parsedValue }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveOpenAISettings(settings);
      toast.success("Configuración guardada con éxito");
    } catch (err) {
      toast.error("Error al guardar la configuración");
    }

    setLoading(false);
  };

  return (
    <Container>
      <Paper className={classes.mainPaper}>
        <Typography variant="h6">Configuración de OpenAI</Typography>
        <form className={classes.form} onSubmit={handleSave}>
          <TextField
            label="API Key"
            name="key"
            value={settings.key}
            onChange={handleChange}
            variant="outlined"
            type="password"
            required
            fullWidth
          />
          <TextField
            select
            label="Modelo"
            name="model"
            value={settings.model}
            onChange={handleChange}
            variant="outlined"
            required
            fullWidth
          >
            {models.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Temperatura"
            name="temperature"
            value={settings.temperature}
            onChange={handleChange}
            variant="outlined"
            type="number"
            inputProps={{ step: "0.1", min: "0", max: "2" }}
            required
            fullWidth
          />
          <TextField
            label="Máximo de Tokens"
            name="maxTokens"
            value={settings.maxTokens}
            onChange={handleChange}
            variant="outlined"
            type="number"
            inputProps={{ min: "1", max: "4000" }}
            required
            fullWidth
          />
          <TextField
            label="Mensaje del Sistema"
            name="systemMessage"
            value={settings.systemMessage}
            onChange={handleChange}
            variant="outlined"
            multiline
            rows={4}
            required
            fullWidth
            helperText="Este mensaje define el comportamiento del asistente"
          />
          <div className={classes.btnWrapper}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Paper>
    </Container>
  );
};

export default OpenAISettings;
