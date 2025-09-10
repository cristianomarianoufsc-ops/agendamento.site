# **Documento de Análise do Site de Agendamento (Atualizado)**

Este documento descreve o site de agendamento, detalhando sua estrutura, funcionalidades e as tecnologias utilizadas, com foco na arquitetura atual de um único componente (App.jsx) para gerenciar todo o fluxo de agendamento.

## **1\. Visão Geral do Projeto**

O projeto é uma aplicação web desenvolvida para gerenciar agendamentos para os espaços de 'Teatro' e 'Igrejinha'. O sistema permite que o usuário selecione um local, uma data e horários, e em seguida, preencha uma série de formulários detalhados (Dados do Proponente, Proposta, Acessibilidade e Gratuidade) que culminam em uma página de resumo final antes da submissão.

## **2\. Estrutura do Projeto**

A arquitetura atual se baseia em um componente principal (App.jsx) que gerencia o estado da aplicação, controlando qual etapa do agendamento é exibida. Os componentes dos formulários (Calendar, PessoaFisicaForm, Proposta, etc.) são componentes "burros" que recebem dados e funções de callback como propriedades (props), e os enviam de volta para o App.jsx.

Os principais componentes e suas funções são:

* **App.jsx**: O componente raiz que gerencia o estado da aplicação, incluindo a etapa atual, os dados dos formulários e a navegação.  
* **Calendar.jsx**: Permite a seleção de uma data para o agendamento.  
* **TimeBlockSelector.jsx**: Exibe e permite a seleção dos horários disponíveis para a data escolhida.  
* **PessoaFisicaForm.jsx / PessoaJuridicaForm.jsx**: Coletam os dados pessoais e de documentação do proponente.  
* **Proposta.jsx**: Coleta informações sobre o vínculo institucional da proposta com a UFSC.  
* **DadosDaProposta.jsx**: Coleta os detalhes da proposta, como nome do evento, sinopse, links e arquivos complementares.  
* **ResumoProposta.jsx**: Exibe um resumo dos dados da proposta para revisão.  
* **AcessComu.jsx**: Coleta informações sobre acessibilidade e comunicação.  
* **Gratuidade.jsx**: Coleta informações sobre a gratuidade do evento.  
* **ResumoTotal.jsx**: A página final que consolida todos os dados do agendamento para revisão final antes da submissão.

## **3\. Fluxo de Agendamento (Novo)**

O fluxo de agendamento agora é gerenciado pelo estado centralizado no App.jsx, utilizando um objeto formData. O fluxo se desenha da seguinte maneira:

1. **Seleção do Local**: O usuário escolhe entre 'Teatro' e 'Igrejinha'.  
2. **Seleção de Data e Horário**: O Calendar permite a seleção da data, e o TimeBlockSelector permite a seleção de um bloco de horário.  
3. **Tipo de Proponente**: O usuário seleciona 'Pessoa Física' ou 'Pessoa Jurídica'.  
4. **Formulário do Proponente**: O formulário apropriado (PessoaFisicaForm ou PessoaJuridicaForm) é preenchido e os dados são salvos no estado formData.  
5. **Proposta**: O formulário Proposta é preenchido.  
6. **Dados da Proposta**: O formulário DadosDaProposta é preenchido.  
7. **Resumo da Proposta**: O ResumoProposta é exibido, mostrando os dados preenchidos nas etapas anteriores.  
8. **Acessibilidade e Comunicação**: O formulário AcessComu é preenchido.  
9. **Gratuidade**: O formulário Gratuidade é preenchido.  
10. **Resumo Total**: Todos os dados coletados são exibidos em uma única página para revisão final.

## **4\. Tecnologias e Dependências**

* **Frontend**: React com JSX para a interface do usuário.  
* **Estilização**: O projeto utiliza classes de utilitários do **Tailwind CSS** para estilizar os componentes, como botões, formulários e o layout em geral.

## **5\. Observações e Melhorias Potenciais**

* **Persistência de Dados**: Embora o fluxo de dados no frontend esteja funcional, a submissão final ainda não salva os dados em um backend. A próxima etapa crítica é integrar um banco de dados (como Firestore ou outro) para armazenar os agendamentos.  
* **Validação de Formulários**: A validação dos formulários, como a do CEP, está presente, mas validações mais robustas para campos obrigatórios e formatos de dados podem ser aprimoradas.  
* **Upload de Arquivos**: O projeto permite a seleção de arquivos, mas a lógica para fazer o upload desses arquivos para um serviço de armazenamento em nuvem (como Cloud Storage) ainda precisa ser implementada.  
* **Autenticação**: Não há um sistema de autenticação, o que é fundamental para um sistema de agendamento real para rastrear quem faz cada reserva.